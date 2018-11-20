var MidiPlayer = require('midi-player-js');
var sounds = require('soundfont-player');
var buckets = require('buckets-js');

//////////// GLOBALS ///////////////////

var ac = new AudioContext();
var Player = new MidiPlayer.Player();

// arrays to hold queues for each note
var noteEventQueues = new Array(88);
var noteLengthQueues = new Array(88);
for (var i = 0; i < 88; i++) {
    noteEventQueues[i] = buckets.Queue();
    noteLengthQueues[i] = buckets.Queue();
}

// queue for each note holding all events for that note
// take two elements at a time, gives noteOn then noteOff pairs.
// noteOff tick - noteOn tick = length of note
// then somehow calculate actual length of note based on horizontal speed (TODO later)
// add to second queue for this note, which contains length of each subsequent note
// so when a noteOn event happens when playing, we just take the next queue item for this note
// then send events to midiAnimation as before (actually playing the midi file Player.play()) but this time include note length so size will vary based on note length
// options for playing the actual sound are either a set delay,
// or when they reach a certain coordinate they send an event for that note to play

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
    // note length
    noteEventQueues.forEach((eventQueue, pianoNote) => {
        var noteLengthQueue = noteLengthQueues[pianoNote];
        while (!eventQueue.isEmpty()) {
            var noteOn = eventQueue.dequeue();
            var noteOff = eventQueue.dequeue();
            var noteLength = noteOff.tick - noteOn.tick;
            noteLengthQueue.enqueue(noteLength);
        }
    });
}

// handler for midi events. determines the type of event and generates custom
// events based on the event type
function handleMidiEvent(event, piano) {
    console.log(event);
    if (event.name === 'Note on') {

        var pianoNote = midiNoteToPianoNote(event.noteNumber)
        var noteLength = noteLengthQueues[pianoNote].dequeue();

        // non-zero velocity means note on
        if (event.velocity != 0) {
            dispatchEvent(new CustomEvent('noteOn', {detail: {
                pianoNote: pianoNote,
                noteLength: noteLength
            }}));
            piano.play(event.noteNumber, ac.currentTime, {gain:event.velocity/127, sustain:0});
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


//////////// MODULE INTERFACE /////////////////////
var exports = module.exports = {};

// initializes the player with a specified midi file
exports.initialize = function(midiFile) {
    sounds.instrument(ac, 'acoustic_grand_piano').then((piano) => {
        Player.on('midiEvent', (event) => {
            handleMidiEvent(event, piano);
        });
        // Player.loadFile('./res/clair_de_lune.mid');
        Player.loadFile(midiFile);
        // assume only one midi track so take first index of events array
        preprocessMidiEvents(Player.getEvents()[0]);
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
