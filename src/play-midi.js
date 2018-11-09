/////////// MIDI STUFF ///////////////////////

var MidiPlayer = require('midi-player-js');
var sounds = require('soundfont-player');


var playButton = document.getElementById('playBtn');
var pauseButton = document.getElementById('pauseBtn');

// load soundfonts
var ac = new AudioContext();
var Player = new MidiPlayer.Player();
var pedal = true;
var pedalNotes = new Set();

sounds.instrument(ac, 'acoustic_grand_piano').then((piano) => {

    Player.on('midiEvent', (event) => {
        handleMidiEvent(event, piano);
    });
    Player.loadFile('./res/bergam3.mid');

    playButton.disabled = false;
    pauseButton.disabled = false;
});


function handleMidiEvent(event, piano) {

    console.log(event);

    if (event.name === 'Note on') {
        // non-zero velocity means note on
        if (event.velocity != 0) {
            dispatchEvent(new CustomEvent('noteOn', {detail: event.noteNumber}));
            piano.play(event.noteNumber, ac.currentTime, {gain:event.velocity/127, sustain:2, release:20});
        } else {
            // velocity of zero means note off
            dispatchEvent(new CustomEvent('noteOff', {detail: event.noteNumber}));
        }

    }

    // if (event.name === 'Controller Change' && event.number == 64) {
    //
    //     pedal = !pedal;
    //     console.log(pedalNotes);
    //
    //     if (!pedal) {
    //         pedalNotes.forEach((note) => {
    //             piano.stop(note);
    //         });
    //         pedalNotes.clear();
    //     }
    //
    //     console.log(pedal);
    //
    // }
}

function startPlayer() {
    isPlaying = true;
    Player.play();
}

function pausePlayer() {
    isPlaying = false;
    activeNoteCode = null;
    Player.pause();
}



////////// ANIMATION STUFF ///////////////////////////////////////

var inactiveColor = 'rgba(0, 200, 255, 0.75)';
var activeColor = 'rgba(200, 100, 0, 0.75)';

var elem = document.getElementById('two');
var two = new Two({ width:2000, height:500 }).appendTo(elem);

var notes = [];
var width = 40;
var height = 100;

for (var i = 0; i < 88; i++) {
    var note = two.makeRectangle(i * width, 0, width, height);
    note.fill = inactiveColor;
    notes[i] = note;
}

var group = two.makeGroup(notes);
group.translation.set(40, two.height / 2);
group.scale = 0.5;
// group.noStroke();

two.update();

// Bind a function to scale and rotate the group
// to the animation loop.
var activeNoteCode = null;
var noteToClear = null;
var isPlaying = false;
two.bind('update', function(frameCount) {

    if (isPlaying) {
        if (activeNoteCode != null) {
            notes[activeNoteCode].fill = activeColor;
            activeNoteCode = null;
        }
        if (noteToClear != null) {
            notes[noteToClear].fill = inactiveColor;
            noteToClear = null;
        }
    } else {
        notes.forEach(function(note) {
            note.fill = inactiveColor;
        });
    }

}).play();

// noteOn event contains the midi note number
addEventListener('noteOn', function(event) {
    activeNoteCode = event.detail - 22;
});

addEventListener('noteOff', function(event) {
    noteToClear = event.detail - 22;
})
