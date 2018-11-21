const CANVAS_HEIGHT = 1000;
const CANVAS_WIDTH = 2000;
const PREVIEW_HEIGHT = 200;
const PREVIEW_WIDTH = 300;
const NOTE_RADIUS = 4;

var buckets = require('buckets-js'); // for queue data structure

// initialize the canvas
var elem = document.getElementById('two');
var two = new Two({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).appendTo(elem);

// init preview canvas
var preview = document.getElementById('two-preview');
var twoPreview = new Two({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).appendTo(preview);

// obtain references to UI elements and register listeners for change in values
var scrollSpeed = document.getElementById('scrollSpeed');
var noteColor = document.getElementById('noteColor');
var bgColor = document.getElementById('bgColor');

scrollSpeed.addEventListener('input', updateScrollSpeed);

//////////// PREVIEW CANVAS ///////////////////
var previewBackground = twoPreview.makeRectangle(PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2, PREVIEW_WIDTH, PREVIEW_HEIGHT);
previewBackground.noStroke();
previewBackground.fill = bgColor.value;
var previewNote = twoPreview.makeRoundedRectangle(PREVIEW_WIDTH / 2, PREVIEW_HEIGHT / 2, 80, CANVAS_HEIGHT / 88, NOTE_RADIUS);
previewNote.noStroke();
previewNote.fill = noteColor.value;
twoPreview.update();
noteColor.addEventListener('input', function(e) {
    previewNote.fill = noteColor.value;
    twoPreview.update();
});
bgColor.addEventListener('input', function(e) {
    previewBackground.fill = bgColor.value;
    twoPreview.update();
    updateBackgroundColor(); // for the main canvas
});


/////////// MAIN ANIMATION LOOP /////////////////////
var isPlaying = false;
var timePassed = 0;
// notes waiting to be drawn
var drawNoteQueue = buckets.Queue();
// notes drawn that should be kept track of
var activeNotes = new Set();
// 88 notes on a piano so split height equally for each note
var noteHeight = CANVAS_HEIGHT / 88;
// keep track of how much the scene has moved
var offset = 0;
// units per second (more human readable and easy to work with, adjust this variable to change rate)
var scrollRatePerSecond = scrollSpeed.value;
// units per frame = units per second / frames per second
var scrollRate = scrollRatePerSecond / 60;

var playBarWidth = 2;
var playBar = two.makeRectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, playBarWidth, CANVAS_HEIGHT);
var playBarCollisionPoint = CANVAS_WIDTH / 2 + playBarWidth / 2;
playBar.fill = '#000000';
playBar.opacity = 0.5;

var background = two.makeRectangle(CANVAS_WIDTH/2, CANVAS_HEIGHT/2, CANVAS_WIDTH, CANVAS_HEIGHT);
background.fill = bgColor.value;
background.noStroke();

two.bind('update', function() {

    if (two.timeDelta != undefined) {
        timePassed += two.timeDelta;
    }

    if (isPlaying) {
        // shifting the scene gives the scrolling effect
        two.scene.translation.x -= scrollRate;
        playBar.translation.x += scrollRate;
        background.translation.x += scrollRate;
        offset += scrollRate;

        activeNotes.forEach((note) => {
            if (note.shape.translation.x <= offset + playBarCollisionPoint + note.width / 2) {
                note.shape.opacity = 0.5;
                activeNotes.delete(note);
                dispatchEvent(new CustomEvent('playNote', {detail: note.pianoNote}));
            }
        });

        if (!drawNoteQueue.isEmpty()) {
            // if the queue has more than one note a chord is probably being played.
            // show up to ten notes at once in this case so they appear simultaneously.
            var count = 10;
            while (count > 0 && !drawNoteQueue.isEmpty()) {
                // add note at specified location
                drawNoteAtIndex(drawNoteQueue.dequeue(), offset);
                count--;
            }
        }
    } else {
        drawNoteQueue.clear();
    }

}).play(); // effectively 60 updates per second

// helper function to draw a note at the specified index
function drawNoteAtIndex(noteEvent, xOffset) {
    var noteWidth = calculateNoteWidth(noteEvent.noteLength);
    var note = two.makeRoundedRectangle(
        2000 + xOffset + noteWidth / 2,
        CANVAS_HEIGHT - noteEvent.pianoNote * noteHeight,
        noteWidth,
        noteHeight,
        NOTE_RADIUS
    );
    note.fill = noteColor.value;
    note.noStroke();
    activeNotes.add({shape: note, width: noteWidth, pianoNote: noteEvent.pianoNote});
}

// calculates the correct note width so its length on screen matches the notes realtime length
function calculateNoteWidth(noteLengthMillisec) {
    // width = scrollRatePerSec * length in seconds
    return scrollRatePerSecond * noteLengthMillisec / 1000;
}

function updateScrollSpeed() {
    scrollRatePerSecond = scrollSpeed.value;
    scrollRate = scrollRatePerSecond / 60;
}

function updateBackgroundColor() {
    background.fill = bgColor.value;
}

var exports = module.exports = {};

exports.pause = function() {
    isPlaying = false;
}

exports.start = function() {
    isPlaying = true;
}

exports.stop = function() {
    isPlaying = false;
    // clear all existing shapes
    activeNotes.forEach((note) => {
        note.shape.fill = '#FFFFFF';
        note.shape.noStroke();
    })
    activeNotes.clear();
}

// adds to the note on queue. will show the note as played.
// note should be a piano key: between 0 and 87 inclusive
exports.queueNoteOn = function(noteOnEvent) {
    drawNoteQueue.enqueue(noteOnEvent);
}

// adds to the note off queue. will stop showing this note.
// note code should be between 0 and 87 inclusive
exports.queueNoteOff = function(noteCode) {
//    inactiveNoteQueue.enqueue(noteCode);
}



















// var notes = [];
// var width = 100;
// var height = CANVAS_HEIGHT / 88;
//
// for (var i = 0; i < 88; i++) {
//     var note = two.makeRectangle(0, CANVAS_HEIGHT - i * height, width, height);
//     note.fill = inactiveColor;
//     notes[i] = note;
// }
//
// var group = two.makeGroup(notes);
// group.translation.set(width / 2 , height / 2);
// group.scale = 0.5;
//
// two.update();
//
//
// var activeNoteQueue = buckets.Queue();
// var inactiveNoteQueue = buckets.Queue();
// var isPlaying = false;
// two.bind('update', function(frameCount) {
//
//     if (isPlaying) {
//         if (!activeNoteQueue.isEmpty()) {
//             // if the queue has more than one note a chord is probably being played.
//             // show up to ten notes at once in this case so they appear simultaneously.
//             if (activeNoteQueue.size() > 1) {
//                 var count = 10;
//                 while (count > 0 && !activeNoteQueue.isEmpty()) {
//                     notes[activeNoteQueue.dequeue()].fill = activeColor;
//                     count--;
//                 }
//             } else { // otherwise just show the one note
//                 notes[activeNoteQueue.dequeue()].fill = activeColor;
//             }
//         }
//         if (!inactiveNoteQueue.isEmpty()) {
//             notes[inactiveNoteQueue.dequeue()].fill = inactiveColor;
//         }
//     } else {
//         notes.forEach(function(note) {
//             note.fill = inactiveColor;
//         });
//         activeNoteQueue.clear();
//         inactiveNoteQueue.clear();
//     }
//
// }).play();
