const CANVAS_HEIGHT = 1000;
const CANVAS_WIDTH = 2000;

var buckets = require('buckets-js'); // for queue data structure

var inactiveColor = 'rgba(0, 200, 255, 0.75)';
var activeColor = 'rgba(200, 100, 0, 0.75)';

// initialize the canvas
var elem = document.getElementById('two');
var two = new Two({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }).appendTo(elem);

var isPlaying = false;

var timePassed = 0;
// notes waiting to be drawn
var drawNoteQueue = buckets.Queue();
// notes drawn that should be kept track of
var activeNotes = new Set();
var noteHeight = CANVAS_HEIGHT / 88;
var offset = 0;
// units per second (more human readable and easy to work with, adjust this variable to change rate)
var scrollRatePerSecond = 200;
// units per frame = units per second / frames per second
var scrollRate = scrollRatePerSecond / 60;

var playBarWidth = 2;
var playBar = two.makeRectangle(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, playBarWidth, CANVAS_HEIGHT);
var playBarCollisionPoint = CANVAS_WIDTH / 2 + playBarWidth / 2;
playBar.fill = "#000000";
playBar.opacity = 0.5;

two.bind('update', function() {

    if (two.timeDelta != undefined) {
        timePassed += two.timeDelta;
    }

    if (isPlaying) {
        // shifting the scene gives the scrolling effect
        two.scene.translation.x -= scrollRate;
        playBar.translation.x += scrollRate;
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
    var note = two.makeRectangle(
        2000 + xOffset + noteWidth / 2,
        CANVAS_HEIGHT - noteEvent.pianoNote * noteHeight,
        noteWidth,
        noteHeight
    );
    note.fill = activeColor;
    activeNotes.add({shape: note, width: noteWidth, pianoNote: noteEvent.pianoNote});
}

// calculates the correct note width so its length on screen matches the notes realtime length
function calculateNoteWidth(noteLengthMillisec) {
    // width = scrollRatePerSec * length in seconds
    return scrollRatePerSecond * noteLengthMillisec / 1000;
}

var exports = module.exports = {};

exports.stop = function() {
    isPlaying = false;
}

exports.start = function() {
    isPlaying = true;
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
