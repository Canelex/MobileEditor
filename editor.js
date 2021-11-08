// Geometry variables
let el = document.getElementById("page-list")
let lx;
let ly;
let ls;
let x;
let y;
let s;
let ww = Math.min(window.innerWidth, 768);
let wh = window.innerHeight;

// Transformations
let translate = { x: 0, y: el.clientHeight };
let scale = ww / el.clientWidth;
constrain();

function updateElementTransform() {
    // Offset the page
    let ew = el.clientWidth;
    let eh = el.clientHeight;
    let ww = window.innerWidth;
    let wh = window.innerHeight;

    // Update the fixed position
    el.style.left = ((ww - ew) / 2) + 'px';
    el.style.top = ((wh - eh) / 2) + 'px'

    // Concat string
    let value = [
        `translate3d(${translate.x}px, ${translate.y}px, 0px)`,
        `scale(${scale}, ${scale})`
    ].join(" ")

    // Update position on screen
    el.style.transform = value;
    el.style.mozTransform = value;
    el.style.webkitTransform = value;
}

// HammerJS hooks
let hammer = new Hammer.Manager(el.parentElement, {})
hammer.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
hammer.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith(hammer.get('pan'));

hammer.on('panmove', (event) => {
    // Store mouse pos
    x = event.center.x;
    y = event.center.y;

    // Calculate delta
    let dx = x - lx;
    let dy = y - ly;
    translate.x += dx;
    translate.y += dy;
    constrain();

    // Update last pos
    lx = x;
    ly = y;
});

hammer.on('panstart', (event) => {
    lx = event.center.x;
    ly = event.center.y;
})

hammer.on('pinchmove', (event) => {
    // Store scale pos
    s = event.scale;

    // Calculate delta
    let ds = s - ls;
    let scaleBefore = scale;
    scale *= (1 + ds);
    constrain();
    let change = scale - scaleBefore;

    if (scale < 0.2) {
        scale = 0.2;
    }
    if (scale > 5) {
        scale = 5;
    }

    // Translate too
    let ty = el.clientHeight / 2 * change;
    let tx = el.clientWidth / 2 * change;
    translate.y += ty * (translate.y / (scale * el.clientHeight / 2));
    translate.x += tx * (translate.x / (scale * el.clientWidth / 2));
    constrain();

    // Update last pos
    ls = s;
})

hammer.on('pinchstart', (event) => {
    ls = event.scale;
})

document.onwheel = (event) => {
    translate.y -= event.deltaY;
    constrain();
}

// Infinite cycle
function update() {
    // Update transform
    updateElementTransform();
    requestAnimationFrame(update);
}

function constrain() {

    // Constrain horizontally
    let termx = scale * el.clientWidth / 2;
    if (translate.x + termx < ww / 2) {
        translate.x = ww / 2 - termx
    }

    if (translate.x - termx > -ww / 2) {
        translate.x = -ww / 2 + termx
    }

    // Constrain vertically
    let termy = scale * el.clientHeight / 2;
    let bonus = 100;
    if (translate.y + termy < wh / 2 - bonus) {
        translate.y = -termy + wh / 2 - bonus;
    }
    if (translate.y - termy > -wh / 2) {
        translate.y = termy - wh / 2;
    }

    // Constrain scale
    if (el.clientWidth * scale < ww) {
        scale = ww / el.clientWidth;
    }
}

requestAnimationFrame(update);