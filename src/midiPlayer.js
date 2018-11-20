var MidiPlayer = require('midi-player-js');
var sounds = require('soundfont-player');
var buckets = require('buckets-js');

//////////// GLOBALS ///////////////////

var ac = new AudioContext();
var Player = new MidiPlayer.Player();
var pianoSoundfont;

var millisecPerTick;

// arrays to hold queues for each note
var noteEventQueues = new Array(88);
var noteLengthQueues = new Array(88);
for (var i = 0; i < 88; i++) {
    noteEventQueues[i] = buckets.Queue();
    noteLengthQueues[i] = buckets.Queue();
}

// takes an array of midi events and preprocesses them so that we know the
// length of notes (and other information) when the midi is played real time
function preprocessMidiEvents(events) {

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
    // note length. Then convert it to a length in milliseconds
    noteEventQueues.forEach((eventQueue, pianoNote) => {
        var noteLengthQueue = noteLengthQueues[pianoNote];
        while (!eventQueue.isEmpty()) {
            var noteOn = eventQueue.dequeue();
            var noteOff = eventQueue.dequeue();
            var tickLength = noteOff.tick - noteOn.tick;
            var noteLengthMillisec = millisecPerTick * tickLength;
            noteLengthQueue.enqueue(noteLengthMillisec);
        }
    });
}

// handler for midi events. determines the type of event and generates custom
// events based on the event type
function handleMidiEvent(event, piano) {
    if (event.name === 'Note on') {

        var pianoNote = midiNoteToPianoNote(event.noteNumber)
        var noteLength = noteLengthQueues[pianoNote].dequeue();

        // non-zero velocity means note on
        if (event.velocity != 0) {
            dispatchEvent(new CustomEvent('noteOn', {detail: {
                pianoNote: pianoNote,
                noteLength: noteLength
            }}));
            // piano.play(event.noteNumber, ac.currentTime, {gain:event.velocity/127, sustain:0});
        } else {
            // velocity of zero means note off
            dispatchEvent(new CustomEvent('noteOff', {detail: midiNoteToPianoNote(event.noteNumber)}));
        }

    } else if (event.name === 'Note off') {
        dispatchEvent(new CustomEvent('noteOff', {detail: midiNoteToPianoNote(event.noteNumber)}));
    }
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
    sounds.instrument(ac, 'acoustic_grand_piano').then((piano) => {
        pianoSoundfont = piano;
        Player.on('midiEvent', (event) => {
            handleMidiEvent(event, piano);
        });
        // Player.loadFile('./res/clair_de_lune.mid');
        Player.loadFile(midiFile);
        millisecPerTick = calculateTickTime(Player.getDivision().division);
        // assume only one midi track so take first index of events array
        preprocessMidiEvents(Player.getEvents()[0]);
        callback();
    });
};

exports.startPlayer = function() {
    isPlaying = true;
    Player.play();
};

exports.pausePlayer = function() {
    isPlaying = false;
    Player.pause();
};

exports.loadMidiFile = function (file) {
    Player.loadFile('./res/clair_de_lune.mid');
};

exports.playNote = function(pianoNote) {
    pianoSoundfont.play(pianoNoteToMidiNote(pianoNote), ac.currentTime, {gain:1, sustain:0});
}
