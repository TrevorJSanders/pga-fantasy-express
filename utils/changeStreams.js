const mongoose = require('mongoose');
const { handleTournamentChange } = require('./sseHelpers');

/**
 * Initialize MongoDB Change Streams to watch for database changes
 * 
 * Change Streams are a powerful MongoDB feature that lets us watch for real-time
 * changes to collections without polling the database. This is much more efficient
 * than repeatedly querying to check for updates.
 */
const initializeChangeStreams = () => {
  try {
    // Get reference to the tournaments collection
    // Make sure this matches your actual collection name
    const db = mongoose.connection.db;
    const tournamentsCollection = db.collection('tournaments');
    
    // Configure the change stream options
    const changeStreamOptions = {
      // Include the full document in change events (not just the changes)
      fullDocument: 'updateLookup',
      
      // Only watch for specific operations we care about
      // This filters out operations we don't need to broadcast
      operationType: { $in: ['insert', 'update', 'replace', 'delete'] }
    };
    
    console.log('Starting MongoDB Change Stream for tournaments collection...');
    
    // Create the change stream
    const changeStream = tournamentsCollection.watch([], changeStreamOptions);
    
    // Listen for change events
    changeStream.on('change', (changeEvent) => {
      try {
        console.log('Change stream event received:', {
          operation: changeEvent.operationType,
          documentId: changeEvent.documentKey?._id,
          timestamp: new Date().toISOString()
        });
        
        // Process the change and broadcast to SSE clients
        handleTournamentChange(changeEvent);
        
      } catch (error) {
        console.error('Error processing change stream event:', error);
      }
    });
    
    // Handle change stream errors
    changeStream.on('error', (error) => {
      console.error('Change stream error:', error);
      
      // Attempt to restart the change stream after a delay
      setTimeout(() => {
        console.log('Attempting to restart change stream...');
        initializeChangeStreams();
      }, 5000);
    });
    
    // Handle change stream close events
    changeStream.on('close', () => {
      console.log('Change stream closed');
    });
    
    // Store the change stream reference for cleanup
    process.changeStream = changeStream;
    
    console.log('MongoDB Change Stream initialized successfully');
    
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
 * Clean up change streams when shutting down
 * This ensures we properly close database connections
 */
const closeChangeStreams = async () => {
  if (process.changeStream) {
    try {
      await process.changeStream.close();
      console.log('Change stream closed successfully');
    } catch (error) {
      console.error('Error closing change stream:', error);
    }
  }
};

// Handle graceful shutdown
process.on('SIGTERM', closeChangeStreams);
process.on('SIGINT', closeChangeStreams);

module.exports = {
  initializeChangeStreams,
  closeChangeStreams
};