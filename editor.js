let el = document.getElementById("page-list")
let lx;
let ly;
let ls;
let x;
let y;
let s;

let translate = {x: 0, y: 0};
let scale = 1;

function resetPage() {
    
}

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
    let scalebefore = scale;
    scale *= (1 + ds);
    let change = scale - scalebefore;

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
    
    // allow zoom on fingers
    // let cx = event.center.x - window.innerWidth / 2;
    // let cy = event.center.y - window.innerHeight / 2;
    // translate.y += ty * ((translate.y - cy) / (scale * el.clientHeight / 2));
    // translate.x += tx * ((translate.x - cx) / (scale * el.clientWidth / 2));

    // Update last pos
    ls = s;
})

hammer.on('pinchstart', (event) => {
    ls = event.scale;
})

// Reset the page
resetPage();

// Infinite cycle
function update() {
    updateElementTransform();
    requestAnimationFrame(update);
}
requestAnimationFrame(update);