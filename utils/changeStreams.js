const mongoose = require('mongoose');
const EventEmitter = require('events');

const pubsub = new EventEmitter();

const initializeChangeStreams = () => {
  try {
    const db = mongoose.connection.db;
    const tournamentsCollection = db.collection('tournaments');
    const leaderboardsCollection = db.collection('tournament_leaderboards');

    const changeStreamOptions = {
      fullDocument: 'updateLookup',
    };

    console.log('🟡 Starting MongoDB Change Streams...');

    const tournamentsChangeStream = tournamentsCollection.watch([], changeStreamOptions);
    const leaderboardsChangeStream = leaderboardsCollection.watch([], changeStreamOptions);

    tournamentsChangeStream.on('change', (changeEvent) => {
      //console.log('📡 Tournament change detected:', changeEvent);
      try {
        const processedChange = extractChangedFields(changeEvent, 'tournament');
        //console.log(processedChange);
        pubsub.emit('tournamentChange', processedChange);
      } catch (error) {
        console.error('❌ Error in tournament change:', error);
      }
    });

    leaderboardsChangeStream.on('change', (changeEvent) => {
      try {
        const processedChange = extractChangedFields(changeEvent, 'leaderboard');
        pubsub.emit('leaderboardChange', processedChange);
      } catch (error) {
        console.error('❌ Error in leaderboard change:', error);
      }
    });

    tournamentsChangeStream.on('error', (error) => {
      console.error('Tournaments stream error:', error);
      restartChangeStream('tournaments');
    });

    leaderboardsChangeStream.on('error', (error) => {
      console.error('Leaderboards stream error:', error);
      restartChangeStream('leaderboards');
    });

    process.tournamentsChangeStream = tournamentsChangeStream;
    process.leaderboardsChangeStream = leaderboardsChangeStream;

    console.log('✅ MongoDB Change Streams initialized');
  } catch (error) {
    console.error('❌ Failed to initialize change streams:', error);
    setTimeout(() => {
      console.log('Retrying change stream initialization...');
      initializeChangeStreams();
    }, 10000);
  }
};

const extractChangedFields = (changeEvent, collectionType) => {
  const { operationType, fullDocument } = changeEvent;

  const tournamentId = fullDocument?.id || null;

  const changedData = {
    type: `${collectionType}_update`,
    operationType,
    tournamentId,
    collectionType,
    timestamp: new Date().toISOString(),
  };

  if (operationType === 'insert' || operationType === 'replace') {
    changedData.changedFields = fullDocument;
  } else if (operationType === 'update') {
    changedData.changedFields = changeEvent.updateDescription?.updatedFields || {};
    changedData.removedFields = changeEvent.updateDescription?.removedFields || [];
  } else if (operationType === 'delete') {
    changedData.deletedId = tournamentId;
  }

  return changedData;
};

const restartChangeStream = (streamType) => {
  setTimeout(() => {
    console.log(`Restarting ${streamType} change stream...`);
    if (streamType === 'tournaments' && process.tournamentsChangeStream) {
      process.tournamentsChangeStream.close();
    } else if (streamType === 'leaderboards' && process.leaderboardsChangeStream) {
      process.leaderboardsChangeStream.close();
    }
    initializeChangeStreams();
  }, 5000);
};

const closeChangeStreams = async () => {
  const tasks = [];
  if (process.tournamentsChangeStream) {
    tasks.push(process.tournamentsChangeStream.close());
  }
  if (process.leaderboardsChangeStream) {
    tasks.push(process.leaderboardsChangeStream.close());
  }

  try {
    await Promise.all(tasks);
    console.log('✅ All change streams closed');
  } catch (err) {
    console.error('❌ Error closing change streams:', err);
  }
};

process.on('SIGTERM', closeChangeStreams);
process.on('SIGINT', closeChangeStreams);

module.exports = {
  initializeChangeStreams,
  closeChangeStreams,
  extractChangedFields,
  pubsub,
};
