var MidiPlayer = require('midi-player-js');
var sounds = require('soundfont-player');

// load soundfonts
var ac = new AudioContext();
var Player = new MidiPlayer.Player();

var exports = module.exports = {};

// initializes the player with a specified midi file
exports.initialize = function(midiFile) {
    sounds.instrument(ac, 'acoustic_grand_piano').then((piano) => {
        Player.on('midiEvent', (event) => {
            handleMidiEvent(event, piano);
        });
        // Player.loadFile('./res/clair_de_lune.mid');
        Player.loadFile(midiFile);
    });
};

function handleMidiEvent(event, piano) {
    console.log(event);

    if (event.name === 'Note on') {
        // non-zero velocity means note on
        if (event.velocity != 0) {
            dispatchEvent(new CustomEvent('noteOn', {detail: event.noteNumber}));
            piano.play(event.noteNumber, ac.currentTime, {gain:event.velocity/127, sustain:0});
        } else {
            // velocity of zero means note off
            dispatchEvent(new CustomEvent('noteOff', {detail: event.noteNumber}));
        }

    } else if (event.name === 'Note off') {
        dispatchEvent(new CustomEvent('noteOff', {detail: event.noteNumber}));
    }
}

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
