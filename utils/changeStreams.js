//changeStream.js
const mongoose = require('mongoose');
const { handleTournamentChange, handleLeaderboardChange } = require('./sseHelpers');

/**
 * Initialize MongoDB Change Streams to watch for database changes
 *
 * Change Streams are a powerful MongoDB feature that lets us watch for real-time
 * changes to collections without polling the database. This is much more efficient
 * than repeatedly querying to check for updates.
 */
const initializeChangeStreams = () => {
  try {
    // Get reference to the collections
    const db = mongoose.connection.db;
    const tournamentsCollection = db.collection('tournaments');
    const leaderboardsCollection = db.collection('tournament_leaderboards');
   
    // Configure the change stream options for field-level changes
    const changeStreamOptions = {
      // Don't include full document - we'll extract only changed fields
      fullDocument: 'updateLookup',
      
      // Only watch for specific operations we care about
      operationType: { $in: ['insert', 'update', 'replace', 'delete'] }
    };
   
    console.log('Starting MongoDB Change Streams...');
   
    // Create change stream for tournaments
    const tournamentsChangeStream = tournamentsCollection.watch([], changeStreamOptions);
    
    // Create change stream for tournament leaderboards
    const leaderboardsChangeStream = leaderboardsCollection.watch([], changeStreamOptions);
   
    // Listen for tournament change events
    tournamentsChangeStream.on('change', (changeEvent) => {
      try {
        console.log('Leaderboard change stream event received:', {
          operation: changeEvent.operationType,
          documentId: changeEvent.documentKey?._id,
          timestamp: new Date().toISOString()
        });
       
        // Extract only changed fields and process
        const processedChange = extractChangedFields(changeEvent, 'tournament');
        handleTournamentChange(processedChange);
       
      } catch (error) {
        console.error('Error processing tournament change stream event:', error);
      }
    });

    // Listen for leaderboard change events
    leaderboardsChangeStream.on('change', (changeEvent) => {
      try {
        console.log('Leaderboard change stream event received:', {
          operation: changeEvent.operationType,
          documentId: changeEvent.documentKey?._id,
          tournamentId: changeEvent.fullDocument?.id, // ✅ confirm here
          timestamp: new Date().toISOString()
        });
       
        // Extract only changed fields and process
        const processedChange = extractChangedFields(changeEvent, 'leaderboard');
        handleLeaderboardChange(processedChange);
       
      } catch (error) {
        console.error('Error processing leaderboard change stream event:', error);
      }
    });
   
    // Handle change stream errors for tournaments
    tournamentsChangeStream.on('error', (error) => {
      console.error('Tournaments change stream error:', error);
      restartChangeStream('tournaments');
    });

    // Handle change stream errors for leaderboards
    leaderboardsChangeStream.on('error', (error) => {
      console.error('Leaderboards change stream error:', error);
      restartChangeStream('leaderboards');
    });
   
    // Handle change stream close events
    tournamentsChangeStream.on('close', () => {
      console.log('Tournaments change stream closed');
    });

    leaderboardsChangeStream.on('close', () => {
      console.log('Leaderboards change stream closed');
    });
   
    // Store the change stream references for cleanup
    process.tournamentsChangeStream = tournamentsChangeStream;
    process.leaderboardsChangeStream = leaderboardsChangeStream;
   
    console.log('MongoDB Change Streams initialized successfully');
   
  } catch (error) {
    console.error('Failed to initialize change streams:', error);
   
    // Retry after a delay
    setTimeout(() => {
      console.log('Retrying change stream initialization...');
      initializeChangeStreams();
    }, 10000);
  }
};

/**
 * Extract only the changed fields from a change event
 * This reduces the payload size and only sends what actually changed
 */
const extractChangedFields = (changeEvent, collectionType) => {
  const { operationType, documentKey, fullDocument } = changeEvent;

  const tournamentId = fullDocument?.id || null;
  console.log('operationType ' + operationType);
  console.log('documentKey ' + documentKey);
  console.log('fullDocument ' + fullDocument);

  let changedData = {
    operationType,
    documentId: documentKey._id,  // objectid in MongoDB
    tournamentId,
    collectionType,
    timestamp: new Date().toISOString()
  };

  switch (operationType) {
    case 'insert':
    case 'replace':
      changedData.fullDocument = fullDocument;
      changedData.changedFields = fullDocument;
      break;

    case 'update':
      const updatedFields = changeEvent.updateDescription?.updatedFields || {};
      const removedFields = changeEvent.updateDescription?.removedFields || [];

      changedData.changedFields = updatedFields;
      changedData.removedFields = removedFields;
    case 'delete':
      changedData.deletedId = documentKey._id;
      break;

    default:
      console.warn(`Unhandled operation type: ${operationType}`);
  }

  return changedData;
};

/**
 * Restart a specific change stream after an error
 */
const restartChangeStream = (streamType) => {
  setTimeout(() => {
    console.log(`Attempting to restart ${streamType} change stream...`);
    
    // Close existing stream if it exists
    if (streamType === 'tournaments' && process.tournamentsChangeStream) {
      process.tournamentsChangeStream.close();
    } else if (streamType === 'leaderboards' && process.leaderboardsChangeStream) {
      process.leaderboardsChangeStream.close();
    }
    
    // Restart all streams
    initializeChangeStreams();
  }, 5000);
};

/**
 * Clean up change streams when shutting down
 * This ensures we properly close database connections
 */
const closeChangeStreams = async () => {
  const closePromises = [];
  
  if (process.tournamentsChangeStream) {
    closePromises.push(
      process.tournamentsChangeStream.close()
        .then(() => console.log('Tournaments change stream closed successfully'))
        .catch(error => console.error('Error closing tournaments change stream:', error))
    );
  }
  
  if (process.leaderboardsChangeStream) {
    closePromises.push(
      process.leaderboardsChangeStream.close()
        .then(() => console.log('Leaderboards change stream closed successfully'))
        .catch(error => console.error('Error closing leaderboards change stream:', error))
    );
  }
  
  try {
    await Promise.all(closePromises);
    console.log('All change streams closed successfully');
  } catch (error) {
    console.error('Error closing some change streams:', error);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', closeChangeStreams);
process.on('SIGINT', closeChangeStreams);

module.exports = {
  initializeChangeStreams,
  closeChangeStreams,
  extractChangedFields // Export for testing purposes
};