var MidiPlayer = require('midi-player-js');
var sounds = require('soundfont-player');
var buckets = require('buckets-js');

//////////// GLOBALS ///////////////////

var ac = new AudioContext();
var Player;
var pianoSoundfont;

var millisecPerTick;

// takes an array of midi events and preprocesses them so that we know the
// length of notes (and other information) when the midi is played real time
function preprocessMidiEvents(events) {

    // arrays to hold queues for each note
    var noteEventQueues = new Array(88); // to store events for each note
    var noteQueues = new Array(88); // to store calculated information for each note
    for (var i = 0; i < 88; i++) {
        noteEventQueues[i] = buckets.Queue();
        noteQueues[i] = buckets.Queue();
    }

    // initialise the event queue for each note
    events.forEach((event) => {
        // we are only interested in note events
        if (event.name === 'Note on' || event.name === 'Note off') {
            var pianoNote = midiNoteToPianoNote(event.noteNumber);
            // ensure we only access valid note queues
            if (pianoNote >= 0 && pianoNote < 88) {
                noteEventQueues[pianoNote].enqueue(event);
            }
        }
    });

    // take pairs of events from the event queue of each note,
    // these will be note on / note off pairs.
    // then calculate the "tick" difference between each to get the relative
    // note length. Then convert it to a length in milliseconds.
    // and calculate the absolute time this note should appear
    noteEventQueues.forEach((eventQueue, pianoNote) => {
        var noteQueue = noteQueues[pianoNote];
        while (!eventQueue.isEmpty()) {
            var noteOn = eventQueue.dequeue();
            var noteOff = eventQueue.dequeue();
            var tickLength = noteOff.tick - noteOn.tick;
            var noteLengthMillisec = millisecPerTick * tickLength;
            var absoluteTimeSec = millisecPerTick * noteOn.tick / 1000;
            noteQueue.enqueue({noteLength:noteLengthMillisec, absoluteTime: absoluteTimeSec});
        }
    });

    return noteQueues;
}

// converts from midi note number to piano note number (0 to 87)
function midiNoteToPianoNote(midiNote) {
    return midiNote - 22;
}

function pianoNoteToMidiNote(pianoNote) {
    return pianoNote + 22;
}

// calculates the number of milliseconds for a midi tick
// assumes tempo of 120bpm (this is the default)
// formula: 60,000/(bpm * division)
// note division = ticks per beat
function calculateTickTime(division) {
    return 60000 / (120 * division);
}


//////////// MODULE INTERFACE /////////////////////
var exports = module.exports = {};

// initializes the player with a specified midi file
// takes a callback to let caller code know when initialization is done
exports.initialize = function(midiFile, callback) {
    Player = new MidiPlayer.Player();
    sounds.instrument(ac, 'acoustic_grand_piano').then((piano) => {
        pianoSoundfont = piano;
        // Player.loadFile('./res/clair_de_lune.mid');
        Player.loadFile(midiFile);
        millisecPerTick = calculateTickTime(Player.getDivision().division);
        // assume only one midi track so take first index of events array
        var processedNoteQueues = preprocessMidiEvents(Player.getEvents()[0]);
        callback(processedNoteQueues);
    });
};

exports.playNote = function(pianoNote) {
    pianoSoundfont.play(pianoNoteToMidiNote(pianoNote), ac.currentTime, {gain:1, sustain:0});
};
