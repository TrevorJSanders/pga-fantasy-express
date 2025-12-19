//changeStreams.js
const mongoose = require('mongoose');
const logger = require('./logger');
const { publish } = require('./redisPublisher');
const League = require('../models/League');
const Team = require('../models/Team');
const TournamentRoster = require('../models/TournamentRoster');

const handleTournamentStart = async (tournamentId) => {
  try {
    logger.info(`Tournament ${tournamentId} has started. Creating roster snapshots.`);

    // Find all leagues that include this tournament
    const leagues = await League.find({ tournaments: tournamentId });

    for (const league of leagues) {
      // Find all teams in the league
      const teams = await Team.find({ leagueId: league._id });

      for (const team of teams) {
        // Check if a snapshot already exists
        const existingSnapshot = await TournamentRoster.findOne({
          leagueId: league._id,
          teamId: team._id,
          tournamentId,
        });

        if (existingSnapshot) {
          logger.info(`Snapshot already exists for team ${team._id} in league ${league._id} for tournament ${tournamentId}. Skipping.`);
          continue;
        }

        // Create a new TournamentRoster document
        const tournamentRoster = new TournamentRoster({
          leagueId: league._id,
          teamId: team._id,
          tournamentId,
          playerIds: team.activePlayerIds,
        });

        await tournamentRoster.save();
        logger.info(`Created snapshot for team ${team._id} in league ${league._id} for tournament ${tournamentId}`);
      }
    }
  } catch (error) {
    logger.error(`Error creating roster snapshots for tournament ${tournamentId}:`, error.stack || error);
    console.error(`FULL ERROR STACK for tournament ${tournamentId}:`, error);
  }
};

const initializeChangeStreams = () => {
  try {
    const db = mongoose.connection.db;
    const tournamentsCollection = db.collection('tournaments');
    const leaderboardsCollection = db.collection('tournament_leaderboards');
    const leaguesCollection = db.collection('leagues');
    const teamsCollection = db.collection('teams');
    const playersCollection = db.collection('players');
    const invitesCollection = db.collection('invites');

    const changeStreamOptions = {
      fullDocument: 'updateLookup',
    };

    console.log('🟡 Starting MongoDB Change Streams...');

    const tournamentsChangeStream = tournamentsCollection.watch([], changeStreamOptions);
    const leaderboardsChangeStream = leaderboardsCollection.watch([], changeStreamOptions);
    const leaguesChangeStream = leaguesCollection.watch([], changeStreamOptions);
    const teamsChangeStream = teamsCollection.watch([], changeStreamOptions);
    const playersChangeStream = playersCollection.watch([], changeStreamOptions);
    const invitesChangeStream = invitesCollection.watch([], changeStreamOptions);

    tournamentsChangeStream.on('change', (changeEvent) => {
      try {
        if (
          changeEvent.operationType === 'update' &&
          changeEvent.updateDescription.updatedFields &&
          changeEvent.updateDescription.updatedFields.status === 'In Progress'
        ) {
          const tournamentId = changeEvent.documentKey._id;
          handleTournamentStart(tournamentId);
        }

        const processedChange = extractChangedFields(changeEvent, 'tournament');
        logger.info({ change: processedChange }, '[Change Stream] Detected tournament change');
        publish('tournament-changes', processedChange);
      } catch (error) {
        console.error('❌ Error in tournament change:', error);
      }
    });

    leaderboardsChangeStream.on('change', (changeEvent) => {
      try {
        const processedChange = extractChangedFields(changeEvent, 'leaderboard');
        logger.info({ change: processedChange }, '[Change Stream] Detected leaderboard change');
        publish('leaderboard-update', processedChange);
      } catch (error) {
        console.error('❌ Error in leaderboard change:', error);
      }
    });

    leaguesChangeStream.on('change', (changeEvent) => {
      try {
        const processedChange = extractChangedFields(changeEvent, 'league');
        logger.info({ change: processedChange }, '[Change Stream] Detected league change');
        publish('league-updates', processedChange);
      } catch (error) {
        console.error('❌ Error in league change:', error);
      }
    });

    teamsChangeStream.on('change', (changeEvent) => {
      try {
        const processedChange = extractChangedFields(changeEvent, 'team');
        logger.info({ change: processedChange }, '[Change Stream] Detected team change');
        publish('team-updates', processedChange);
      } catch (error) {
        console.error('❌ Error in team change:', error);
      }
    });

    playersChangeStream.on('change', (changeEvent) => {
      try {
        const processedChange = extractChangedFields(changeEvent, 'player');
        logger.info({ change: processedChange }, '[Change Stream] Detected player change');
        publish('player-availability-updates', processedChange);
      } catch (error) {
        console.error('❌ Error in player change:', error);
      }
    });

    invitesChangeStream.on('change', (changeEvent) => {
      try {
        const processedChange = extractInviteFields(changeEvent);
        if (processedChange.userId) {
          logger.info({ change: processedChange }, '[Change Stream] Detected invite change');
          publish('invite-updates', processedChange);
        }
      } catch (error) {
        console.error('❌ Error in invite change:', error);
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
    process.leaguesChangeStream = leaguesChangeStream;
    process.teamsChangeStream = teamsChangeStream;
    process.playersChangeStream = playersChangeStream;
    process.invitesChangeStream = invitesChangeStream;

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
  const { operationType, fullDocument, documentKey } = changeEvent;

  let id = null;
  let leagueId = null;
  if (collectionType === 'leaderboard') {
    id = documentKey._id || null;
  } else if (collectionType === 'tournament') {
    id = documentKey._id || null;
  } else if (collectionType === 'league') {
    id = documentKey._id || null;
  } else if (collectionType === 'team') {
    id = documentKey._id || null;
    leagueId = fullDocument?.leagueId || null;
  } else if (collectionType === 'player') {
    id = documentKey._id || null;
  }

  const changedData = {
    type: `${collectionType}_update`,
    operationType,
    id,
    collectionType,
    timestamp: new Date().toISOString(),
  };

  if (leagueId) {
    changedData.leagueId = leagueId;
  }

  if (operationType === 'insert' || operationType === 'replace') {
    changedData.changedFields = fullDocument;
  } else if (operationType === 'update') {
    changedData.changedFields = changeEvent.updateDescription?.updatedFields || {};
    changedData.removedFields = changeEvent.updateDescription?.removedFields || [];
  } else if (operationType === 'delete') {
    changedData.deletedId = id;
  }

  return changedData;
};

const extractInviteFields = (changeEvent) => {
  const { operationType, fullDocument, documentKey } = changeEvent;
  const changedData = {
    type: 'invite_update',
    operationType,
    id: documentKey._id || null,
    userId: fullDocument?.user || null,
    collectionType: 'invite',
    timestamp: new Date().toISOString(),
  };

  if (operationType === 'insert' || operationType === 'replace') {
    changedData.changedFields = fullDocument;
  } else if (operationType === 'update') {
    changedData.changedFields = changeEvent.updateDescription?.updatedFields || {};
    changedData.removedFields = changeEvent.updateDescription?.removedFields || [];
  } else if (operationType === 'delete') {
    changedData.deletedId = documentKey._id || null;
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
    } else if (streamType === 'leagues' && process.leaguesChangeStream) {
      process.leaguesChangeStream.close();
    } else if (streamType === 'teams' && process.teamsChangeStream) {
      process.teamsChangeStream.close();
    } else if (streamType === 'players' && process.playersChangeStream) {
      process.playersChangeStream.close();
    } else if (streamType === 'invites' && process.invitesChangeStream) {
      process.invitesChangeStream.close();
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
  if (process.leaguesChangeStream) {
    tasks.push(process.leaguesChangeStream.close());
  }
  if (process.teamsChangeStream) {
    tasks.push(process.teamsChangeStream.close());
  }
  if (process.playersChangeStream) {
    tasks.push(process.playersChangeStream.close());
  }
  if (process.invitesChangeStream) {
    tasks.push(process.invitesChangeStream.close());
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
  extractInviteFields,
};