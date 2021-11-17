// Data
let formID;
let officeID;
let pdfURL;
let pdfObj;
let numPages;
let numPagesLoaded;
var loadingBar = new ldBar("#loading-bar");

// UI
let translate = { x: 0, y: 0 };
let scale = 1;

// Tools and annotations
let selectedTool = 0;
let pages = []; // list of annotations
let selectedPage;
let selectedAnnotation;
let drag = false;

/** PDFJS */

function loadPDF(url) {
    /**
     * Step 1: Load PDFJS object from BLOB
     * Step 2: For each page, create a "page" div and append it to "pagelist"
     * Step 3: Append a canvas to each "page" div
     * Step 4: Render the page contents to each canvas
     * Step 5: Change background of "page" div to canvas contents
     * Step 6: Clear canvas and use it for annotations.
     */

    // Convert blob to URL
    pdfURL = url;
    const pageList = document.getElementById('page-list');

    // Load page
    pdfjsLib.getDocument(url).promise.then((pdf) => {

        // List of promises
        let promises = [];
        pdfObj = pdf;
        numPages = pdf._pdfInfo.numPages;
        numPagesLoaded = 0;

        // For each page
        for (let index = 0; index < numPages; index++) {

            // Create an element (page rendering)
            let el = document.createElement('div');
            el.className = 'page'
            el.setAttribute('data-id', index);
            pageList.appendChild(el);

            // Create the annotation canvas
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d')
            canvas.className = 'page-canvas'
            canvas.setAttribute('data-id', index);
            el.appendChild(canvas);

            // Create and store pageData
            let pageData = {
                id: index,
                needsUpdate: false,
                annotations: []
            }
            pages.push(pageData);

            // Get the page load promise
            let promisePage = pdfObj.getPage(index + 1)
            promises.push(promisePage);

            // When page loads
            promisePage.then((page) => {
                // Check data validity
                if (!(page && page._pageInfo && page._pageInfo.view)) {
                    console.error('Failed to retrieve page info');
                    return;
                }

                // Store page metadata
                let pageInfoView = page._pageInfo.view;
                pageData.width = pageInfoView[2]; // Store source width
                pageData.height = pageInfoView[3]; // Store source height
                pageData.scale = Math.floor(2400 / pageData.height); // TODO: Smarter scaling

                // Get viewport. Update element and canvas
                let viewport = page.getViewport({ scale: pageData.scale });
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                el.style.width = viewport.width + 'px';
                el.style.height = viewport.height + 'px';

                // Render the page
                page.render({ viewport, canvasContext: context }).promise.then(() => {
                    // Update background
                    let val = canvas.toDataURL("image/jpeg")
                    el.style.backgroundImage = `url(${val}`;

                    // Clear annotation canvas
                    context.clearRect(0, 0, canvas.width, canvas.height);
                }).catch(err => {
                    console.error('Failed to render page', err)
                });

                // Update loading bar
                numPagesLoaded++;
                loadingBar.set(numPagesLoaded / numPages * 100);
            }).catch(err => {
                console.error('Failed to load page', err)
            });
        }

        Promise.all(promises).then(res => {

            // Setup hammer
            setupHammer();

            // Setup toolbar
            setupToolbar();

            // Reveal page
            setInterval(() => {
                $("#load-page").remove();
            }, 1000)
        });
    });
}

function savePDF() {

    // Translation functions
    let downloadBlob = function (data, fileName, mimeType) {
        var blob, url;
        blob = new Blob([data], {
            type: mimeType
        });
        url = window.URL.createObjectURL(blob);
        downloadURL(url, fileName);
        setTimeout(function () {
            return window.URL.revokeObjectURL(url);
        }, 1000);
    };

    let downloadURL = function (data, fileName) {
        var a;
        a = document.createElement('a');
        a.href = data;
        a.download = fileName;
        document.body.appendChild(a);
        a.style = 'display: none';
        a.click();
        a.remove();
    };

    // Save
    PDFLib.PDFDocument.load(pdfURL, { ignoreEncryption: true }).then(pdf => {

        // Load font before starting PDF
        const helvetica = pdf.embedFont(PDFLib.StandardFonts.Helvetica);

        // Once font is loaded
        helvetica.then(font => {

            let promises = [];

            // For each page
            for (let i in pages) {
                // Page data
                let page = pages[i]
                let pdfPage = pdf.getPages()[i];

                // For each annotation
                for (let an of page.annotations) {
                    switch (an.type) {
                        case 'text':
                            // Draw text
                            pdfPage.drawText(an.value, {
                                x: (an.x / page.scale),
                                y: page.height - (an.y / page.scale) - 15,
                                font: font,
                                size: 15
                            })
                            break;
                        case 'line':
                            let cnv = document.createElement('canvas');
                            let c2d = cnv.getContext('2d');

                            // Calculate canvas dimensions
                            let minX = page.width * page.scale;
                            let minY = page.height * page.scale;
                            let maxX = 0;
                            let maxY = 0;
                            for (let i = 0; i < an.xs.length; i++) {
                                let x = an.xs[i];
                                let y = an.ys[i];
                                minX = Math.min(minX, x);
                                minY = Math.min(minY, y);
                                maxX = Math.max(maxX, x);
                                maxY = Math.max(maxY, y);
                            }
                            let width = maxX - minX + 50;
                            let height = maxY - minY + 50;
                            cnv.width = width;
                            cnv.height = height;

                            // Draw the line
                            // Skip if too short
                            let length = an.xs.length;
                            if (length == 0) {
                                return;
                            }

                            // Translate
                            c2d.translate(25, 25);

                            // Render a dot if too short
                            if (length == 1) {
                                c2d.fillStyle = 'black';
                                c2d.fillRect(an.xs[0] - minX - 3, an.ys[0] - minX - 3, 6, 6)
                                return;
                            }

                            // Render the line
                            c2d.strokeStyle = 'black';
                            c2d.lineWidth = 2 * page.scale;
                            c2d.beginPath();
                            c2d.moveTo(an.xs[0] - minX, an.ys[0] - minY);
                            for (let i = 0; i < length; i++) {
                                c2d.lineTo(an.xs[i] - minX, an.ys[i] - minY);
                            }
                            c2d.stroke();

                            // Embed the image
                            let imgData = cnv.toDataURL('image/png')
                            let promise = pdf.embedPng(imgData);
                            promises.push(promise);

                            // Once the image is embedded
                            promise.then(png => {
                                // Render it
                                pdfPage.drawImage(png, {
                                    x: (minX - 25) / page.scale,
                                    y: page.height - (maxY + 25) / page.scale,
                                    width: png.width / page.scale,
                                    height: png.height / page.scale
                                });
                            });
                        default:
                            console.warn("I don't know how to render " + an.type)
                            break;
                    }
                }
            }

            // Once all embeds are done
            Promise.all(promises).then(() => {
                // Save the pdf
                pdf.save().then(blob => {
                    downloadBlob(blob, 'file.pdf', 'application/octet-stream')
                })
            })


        })
    })
}

/** HammerJS */

function setupHammer() {

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
    translate = { x: 0, y: el.clientHeight };
    scale = ww / el.clientWidth;
    constrain();

    function disableImgEventHandlers() {
        var events = ['onclick', 'onmousedown', 'onmousemove', 'onmouseout', 'onmouseover',
            'onmouseup', 'ondblclick', 'onfocus', 'onblur'];

        events.forEach(function (event) {
            el[event] = function () {
                return false;
            };
        });
    };

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

    function update() {
        // Update transform
        updateElementTransform();

        // For each page
        for (let pi = 0; pi < pages.length; pi++) {
            // Render the annotations
            let page = pages[pi];

            // Page needs update?
            if (page && page.needsUpdate) {
                // Get the canvas
                let canvasEl = $(`canvas[data-id=${pi}]`);

                // Verify we have canvas
                if (canvasEl.length == 0) {
                    console.warn('Could not find canvas for page', pi)
                    continue;
                }

                // Clear canvas
                let canvas = canvasEl[0];
                let context = canvas.getContext('2d')
                context.clearRect(0, 0, canvas.width, canvas.height);

                // Render the annotation
                for (let an of page.annotations) {
                    renderAnnotation(canvas, page, an)
                }

                page.needsUpdate = false;
            }
        }

        requestAnimationFrame(update);
    }

    function renderAnnotation(canvas, page, an) {
        // Get context
        let c2d = canvas.getContext('2d');

        switch (an.type) {
            case 'line':
                // Skip if too short
                let length = an.xs.length;
                if (length == 0) {
                    return;
                }

                // Render a dot if too short
                if (length == 1) {
                    c2d.fillStyle = 'black';
                    c2d.fillRect(an.xs[0] - 3, an.ys[0] - 3, 6, 6)
                    return;
                }

                // Render the line
                c2d.strokeStyle = 'black';
                c2d.lineWidth = 2 * page.scale;
                c2d.beginPath();
                c2d.moveTo(an.xs[0], an.ys[0]);
                for (let i = 0; i < length; i++) {
                    c2d.lineTo(an.xs[i], an.ys[i]);
                }
                c2d.stroke();

                break;
            case 'text':
                // Scale the font (size 14)
                let fontSize = Math.round(14 * page.scale);
                c2d.fillStyle = 'black';
                c2d.font = `${fontSize}px Helvetica`

                // Outline
                if (an.typing) {
                    c2d.strokeStyle = 'black';
                    c2d.lineWidth = 2;
                    let w = Math.max(250, c2d.measureText(an.value).width);
                    c2d.beginPath();
                    c2d.rect(an.x, an.y, w, fontSize + 8);
                    c2d.stroke();
                }

                c2d.fillText(an.value, an.x, an.y + fontSize);
                break;
            default:
            //I don't know how to render this
        }
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
        let bonus = 65;
        if (translate.y + termy < wh / 2) {
            translate.y = -termy + wh / 2;
        }
        if (translate.y - termy > -wh / 2 + bonus) {
            translate.y = termy - wh / 2 + bonus;
        }

        // Constrain scale
        if (el.clientWidth * scale < ww) {
            scale = ww / el.clientWidth;
        }
    }

    // HammerJS hooks
    disableImgEventHandlers();
    let hammer = new Hammer.Manager(el.parentElement, {})
    hammer.add(new Hammer.Pan({ threshold: 0, pointers: 0 }));
    hammer.add(new Hammer.Pinch({ threshold: 0 })).recognizeWith(hammer.get('pan'));

    hammer.on('panmove', (event) => {
        event.preventDefault();

        // Can only move on hand tool
        if (selectedTool != 0) {
            return;
        }

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

        return false;
    });

    hammer.on('panstart', (event) => {
        event.preventDefault();
        lx = event.center.x;
        ly = event.center.y;
        return false;
    })

    hammer.on('pinchmove', (event) => {
        event.preventDefault();
        // Can only scale on hand tool
        if (selectedTool != 0) {
            onMouseUp(null);
        }

        // Store scale pos
        s = event.scale;

        // Calculate delta
        let ds = s - ls;
        let scaleBefore = scale;
        scale *= (1 + ds);
        constrain();
        let change = scale - scaleBefore;

        if (scale < 0) {
            scale = 0;
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

        return false;
    })

    hammer.on('pinchstart', (event) => {
        event.preventDefault();
        ls = event.scale;
        return false;
    })

    document.onwheel = (event) => {
        translate.y -= event.deltaY;
        constrain();
    }

    requestAnimationFrame(update);
}

/** Tools */

function selectTool(id) {

    switch (id) {
        case 4: // Save
            selectedTool = 0;
            savePDF();
            return;
    }

    // Select tool
    selectedTool = id;
    $(`.tool[data-tool=${selectedTool}]`).addClass('active')
}

function setupToolbar() {

    function onClickTool(target, e) {
        // Toggle CSS
        $('.tool').removeClass('active');

        // Get index
        let id = target.data('tool');
        selectTool(id);
    }

    $('.tool>*').click(e => {
        // Call event code
        let target = $(e.target);
        onClickTool(target.parent());

        // Prevent default
        e.preventDefault();
        e.stopPropagation();
    })

    $('.tool').click((e) => {
        // Call event code
        let target = $(e.target);
        onClickTool(target);

        // Prevent default
        e.preventDefault();
        e.stopPropagation();
    });

    $(document).on('mousedown', '.page-canvas', onMouseDown)

    $(document).on('mouseup', '.page-canvas', onMouseUp)

    $(document).on('mousemove', '.page-canvas', onMouseMove)

    $(document).on('touchstart', '.page-canvas', onMouseDown)

    $(document).on('touchend', '.page-canvas', onMouseUp)

    $(document).on('touchmove', '.page-canvas', onMouseMove)

    // Default tool is hand
    selectTool(0);
}

function getRawPos(e) {
    // Get pageX and pageY
    let pageX = e.pageX;
    let pageY = e.pageY;
    if (e.touches) { // It's on mobile!
        let touch = e.touches[0];
        pageX = touch.pageX;
        pageY = touch.pageY;
    }
    return {
        x: pageX,
        y: pageY
    }
}

function getScreenPos(e) {
    // Get pageX and pageY
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (e.touches) { // It's on mobile!
        let touch = e.touches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
    }
    return {
        x: clientX,
        y: clientY
    }
}

function getPointerPos(e) {
    // Get raw position
    let raw = getRawPos(e);

    // Convert it to x and y
    let elCanvas = $(e.target);
    let canvas = elCanvas[0];
    let id = parseInt(elCanvas.data('id'));
    let bb = canvas.getBoundingClientRect();
    let ratio = canvas.width / bb.width;
    let x = (raw.x - bb.left) * ratio;
    let y = (raw.y - bb.top) * ratio;
    return {
        x, y, id, canvas
    }
}

function onMouseDown(e) {
    drag = true;

    // Transform it
    let pointer = getPointerPos(e);
    let newAnnot;

    if (!pointer || !pointer.id) {
        e.preventDefault();
        return;
    }

    switch (selectedTool) {
        case 1: // Line tool
            // Create a new line annotation
            newAnnot = {
                type: 'line',
                page: pointer.id,
                xs: [pointer.x],
                ys: [pointer.y]
            }

            // Store the annotation in the current page
            pages[pointer.id].annotations.push(newAnnot);
            pages[pointer.id].needsUpdate = true;

            // Select the annotation & page
            selectedPage = pages[pointer.id];
            selectedAnnotation = selectedPage.annotations[selectedPage.annotations.length - 1];
            break;

        case 2: // Text tool

            // Create a textbox
            let textarea = document.createElement('textarea');
            textarea.rows = 1;
            textarea.id = "textarea"
            document.body.appendChild(textarea);

            // Create a new text annotation
            newAnnot = {
                type: 'text',
                page: pointer.id,
                x: pointer.x,
                y: pointer.y - 15 * pages[pointer.id].scale,
                value: textarea.value,
                typing: true
            }

            // Store the annotation in the current page
            pages[pointer.id].annotations.push(newAnnot);
            pages[pointer.id].needsUpdate = true;

            // Screen pos. Do we need to move?
            let sp = getScreenPos(e);
            let sy = sp.y / window.innerHeight;
            if (window.innerWidth <= 1024 && sy > 0.5) {
                translate.y -= (sy - 0.5) * window.innerHeight;
            }

            // Focus textbox
            textarea.focus();
            // Delete after unfocused
            textarea.onblur = () => {
                textarea.remove();
                newAnnot.typing = false;
                pages[pointer.id].needsUpdate = true;
            }

            // Update
            textarea.oninput = () => {
                newAnnot.value = textarea.value;
                pages[pointer.id].needsUpdate = true;
            }

            break;
        case 3: // Erase tool
            onMouseMove(e); // Call event for same position (allows erase tap)
            break;
    }

    e.preventDefault();
    return false;
}

function onMouseUp(e) {

    drag = false;
    switch (selectedTool) {
        case 1: // Line tool
            selectedAnnotation = null;
            selectedPage = null;
            break;
        case 2:
            // Nothing
            break;
    }

    return false;
}

function onMouseMove(e) {
    // If they're not dragging, its a hover
    if (!drag) {
        return;
    }

    // Get pointer position
    let pointer = getPointerPos(e);

    // Handle tools
    switch (selectedTool) {
        case 1: // Line tool
            if (selectedAnnotation && selectedPage && selectedPage.id == pointer.id) { //User is selecting an annotation
                let xs = selectedAnnotation.xs;
                let ys = selectedAnnotation.ys;
                xs.push(pointer.x);
                ys.push(pointer.y);
                selectedPage.needsUpdate = true;
            }
            break;

        case 3: // Eraser tool
            let page = pages[pointer.id]
            let annotations = page.annotations;

            // Filter all annotations that are close
            annotations = annotations.filter((an) => {

                switch (an.type) {
                    case 'line':
                        for (let i = 0; i < an.xs.length; i++) {
                            let ax = an.xs[i];
                            let ay = an.ys[i];
                            let dx = ax - pointer.x;
                            let dy = ay - pointer.y;
                            let dt = Math.sqrt(dx * dx + dy * dy);

                            if (dt <= 25) { // within 25 pixels
                                return false;
                            }
                        }

                        return true; // not deleted
                    case 'text':
                        let ax = an.x;
                        let ay = an.y;
                        let dx = ax - pointer.x;
                        let dy = ay - pointer.y;
                        let dt = Math.sqrt(dx * dx + dy * dy);
                        return dt > 25; // within 25 px
                    default:
                    // Unknown annotation
                }


            });

            // Number of annotations changed
            if (annotations.length != page.annotations.length) {
                // Update!
                page.annotations = annotations;
                page.needsUpdate = true;
            }

            break;
    }

    e.preventDefault();
    return false;
}