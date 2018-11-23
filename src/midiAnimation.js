const CANVAS_HEIGHT = 1013;
const CANVAS_WIDTH = 1800;
const PREVIEW_HEIGHT = 200;
const PREVIEW_WIDTH = 300;
const NOTE_RADIUS = 4;
const NOTE_HEIGHT = CANVAS_HEIGHT / 88;

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
    updateNoteColor();
});
bgColor.addEventListener('input', function(e) {
    previewBackground.fill = bgColor.value;
    twoPreview.update();
    updateBackgroundColor(); // for the main canvas
});


/////////// MAIN ANIMATION LOOP /////////////////////
var noteQueues; // all midi information about the notes
var isPlaying = false;
var timePassed = 0;
// notes that need to be kept track of
var activeNoteQueues = new Array(88);
for (var i = 0; i < 88; i++) {
    activeNoteQueues[i] = buckets.Queue();
}
// keep track of all drawn shapes so we can clear the screen
var allNotes = new Set();
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

two.bind('update', function() {

    if (isPlaying) {

        if (two.timeDelta != undefined) {
            timePassed += two.timeDelta; // in milliseconds
        }

        // shifting the scene gives the scrolling effect
        two.scene.translation.x -= scrollRate;
        playBar.translation.x += scrollRate;
        background.translation.x += scrollRate;
        offset += scrollRate;
        // make sure timing is correct so catch up if behind
        var expectedOffset = scrollRatePerSecond * timePassed / 1000;
        if (offset != expectedOffset) {
            offset = expectedOffset;
            two.scene.translation.x = -1 * expectedOffset;
            playBar.translation.x = expectedOffset + CANVAS_WIDTH/2;
            background.translation.x = expectedOffset + CANVAS_WIDTH/2;
        }

        activeNoteQueues.forEach((noteQueue) => {
            if (!noteQueue.isEmpty()) {
                var note = noteQueue.peek();
                if (note.shape.translation.x <= offset + playBarCollisionPoint + note.width / 2) {
                    note.shape.opacity = 0.5;
                    noteQueue.dequeue();
                    dispatchEvent(new CustomEvent('playNote', {detail: note.pianoNote}));
                }
            }
        });
    }

}).play(); // effectively 60 updates per second

// helper function to draw a note at the specified index
// adds to the provided queue to keep track of the notes
function drawNote(noteWidth, xOffset, noteIndex, activeNoteQueue) {
    var note = two.makeRoundedRectangle(
        CANVAS_WIDTH + xOffset + noteWidth / 2,
        CANVAS_HEIGHT - noteIndex * NOTE_HEIGHT,
        noteWidth,
        NOTE_HEIGHT,
        NOTE_RADIUS
    );
    note.fill = noteColor.value;
    note.noStroke();
    allNotes.add(note);
    activeNoteQueue.enqueue({shape: note, width: noteWidth, pianoNote: noteIndex});
}

// calculates the correct note width so its length on screen matches the notes realtime length
function calculateNoteWidth(noteLengthMillisec) {
    // width = scrollRatePerSec * length in seconds
    return scrollRatePerSecond * noteLengthMillisec / 1000;
}

// calculates how far from the origin (x = 0) this note should
// be drawn so that it plays at the given absolute time in seconds.
// x = 0 means play right now
function calculateNoteOffset(absoluteTimeSec) {
    return scrollRatePerSecond * absoluteTimeSec;
}

function updateScrollSpeed() {
    scrollRatePerSecond = scrollSpeed.value;
    scrollRate = scrollRatePerSecond / 60;
    drawEntireMidiFile();
}

function updateBackgroundColor() {
    background.fill = bgColor.value;
}

function updateNoteColor() {
    allNotes.forEach((note) => {
        note.fill = noteColor.value;
    })
}

function drawEntireMidiFile() {

    if (noteQueues != undefined) {
        isPlaying = false;
        timePassed = 0;
        two.scene.translation.clear();
        background.translation.set(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        playBar.translation.set(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
        offset = 0;

        allNotes.forEach((note) => {
            two.remove(note);
        });

        activeNoteQueues.forEach((noteQueue) => {
            noteQueue.clear();
        })

        noteQueues.forEach((noteQueue, pianoNote) => {
            var numNoteEvents = noteQueue.size();
            var activeNoteQueue = activeNoteQueues[pianoNote];
            var count = 0;
            while (count < numNoteEvents) {
                var noteInfo = noteQueue.dequeue();
                noteQueue.enqueue(noteInfo);
                var noteWidth = calculateNoteWidth(noteInfo.noteLength);
                var noteOffset = calculateNoteOffset(noteInfo.absoluteTime);
                drawNote(noteWidth, noteOffset, pianoNote, activeNoteQueue);
                count++;
            }
        });
    }
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

// pre-draws all notes
exports.initialize = function(noteQueuesLocal) {
    noteQueues = noteQueuesLocal;
    drawEntireMidiFile();
}
