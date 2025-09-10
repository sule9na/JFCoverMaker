document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById("preview");
    const ctx = canvas.getContext("2d");

    const loadingEl = document.getElementById("loading");
    const dotsEl = document.getElementById("dots");
    const controlsEl = document.getElementById("controls");

    let img = new Image();
    let baseScale = 1; // scale needed to fill canvas in one dimension
    let settings = {
        url: "",
        scale: 1,
        posX: 0,
        posY: 0,
        darkening: 0,
        title: "Music",
        textColor: "#ffffff",
        sectionColor: "#00ff00",
        gradientAmount: 0.5,
        gradientSize: 0.5,
        glowAmount: 20,
        glowLightness: 0.3,
        fontFamily: "Noto Sans",
        fontSize: 250,
        bold: false,
        italic: false,
        overlayType: "gradient-vertical"
    };

    // Loading dots animation
    let dotCount = 0;
    const dotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        dotsEl.textContent = ".".repeat(dotCount);
    }, 500);

    // --- Google Font Loading ---
    // Load the JSON file
    async function loadFontsJson() {
        const res = await fetch("fonts.json");
        const data = await res.json();
        return data.items;
    }

    // Populate the dropdown
    function populateFontDropdown(fonts) {
        const select = document.getElementById("fontSelect");
        select.innerHTML = "";
        fonts.sort((a, b) => a.family.localeCompare(b.family));
        fonts.forEach(font => {
            const option = document.createElement("option");
            option.value = font.family;
            option.textContent = `${font.family} (${font.category})`;
            select.appendChild(option);
        });
        // Set default to Noto Sans if present
        const notoOption = Array.from(select.options).find(opt => opt.value === "Noto Sans");
        if (notoOption) {
            select.value = "Noto Sans";
        }
    }

    // Load a font dynamically, optionally with weight
    async function loadFont(family, weight = "regular") {
        // Always load both 400 and 700 weights if available
        let weights = ["400"];
        const fontObj = loadedFonts.find(f => f.family === family);
        if (fontObj && fontObj.variants.includes("700")) {
            weights = ["400", "700"];
        }
        for (const w of weights) {
            const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${w}&display=swap`;
            const css = await fetch(fontUrl).then(r => r.text());
            const urlRegex = /url\((https:\/\/[^)]+)\)/g;
            let match;
            while ((match = urlRegex.exec(css)) !== null) {
                const fontFileUrl = match[1];
                const fontFace = new FontFace(family, `url(${fontFileUrl})`, { weight: w });
                await fontFace.load();
                document.fonts.add(fontFace);
            }
        }
        console.log(`Font \"${family}\" loaded with weights ${weights.join(",")}.`);
    }

    // --- Bootstrapping ---
    // Helper to check if font supports bold
    function fontSupportsBold(fonts, family) {
        const font = fonts.find(f => f.family === family);
        return font && font.variants.includes("700");
    }

    async function updateBoldButton(fonts, family) {
        const boldBtn = document.getElementById("boldToggle");
        if (fontSupportsBold(fonts, family)) {
            boldBtn.disabled = false;
            boldBtn.style.opacity = "";
            boldBtn.style.textDecoration = "";
            boldBtn.style.pointerEvents = "";
        } else {
            boldBtn.disabled = true;
            boldBtn.style.opacity = "0.5";
            boldBtn.style.textDecoration = "line-through";
            boldBtn.style.pointerEvents = "none";
            settings.bold = false;
        }
        updateToggleButtons();
    }

    let loadedFonts = [];
    async function initFonts() {
        loadedFonts = await loadFontsJson();
        populateFontDropdown(loadedFonts);
        const select = document.getElementById("fontSelect");
        // Load initial font
        await loadFont(select.value);
        await updateBoldButton(loadedFonts, select.value);
        clearInterval(dotInterval);
        loadingEl.style.display = "none";
        controlsEl.style.display = "block";
        canvas.style.display = "block";
        draw();
        select.addEventListener("change", async e => {
            const family = e.target.value;
            await loadFont(family);
            await updateBoldButton(loadedFonts, family);
            settings.fontFamily = family;
            draw();
        });
    }

    initFonts();

    document.getElementById("imageUpload").addEventListener("change", e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (evt) {
            img = new Image();
            img.onload = () => {
                // Calculate baseScale to fill canvas in one dimension
                const wr = canvas.width / img.width;
                const hr = canvas.height / img.height;
                baseScale = Math.max(wr, hr); // fill at least one side
                settings.scale = 1;
                document.getElementById("imageScale").value = 1;
                // Force draw with correct scale
                setTimeout(() => {
                    draw();
                    document.getElementById("dragMessage").style.display = "block";
                }, 0);
            };
            img.src = evt.target.result;
        };
        reader.readAsDataURL(file);
    });

    // Drag-to-move logic
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let imgStart = { x: 0, y: 0 };
    canvas.addEventListener('mousedown', function (e) {
        if (!img.src) return;
        isDragging = true;
        dragStart.x = e.offsetX;
        dragStart.y = e.offsetY;
        imgStart.x = settings.posX;
        imgStart.y = settings.posY;
    });
    window.addEventListener('mousemove', function (e) {
        if (!isDragging) return;
        // Only update position, not scale
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const dx = (mx - dragStart.x) / canvas.width;
        const dy = (my - dragStart.y) / canvas.height;
        settings.posX = imgStart.x + dx;
        settings.posY = imgStart.y + dy;
        draw();
    });
    window.addEventListener('mouseup', function () {
        isDragging = false;
    });

    // Font change handled in initFonts()

    document.getElementById("fontSize").addEventListener("input", e => {
        settings.fontSize = parseInt(e.target.value, 10);
        draw();
    });

    document.getElementById("boldToggle").addEventListener("click", async e => {
        if (document.getElementById("boldToggle").disabled) return;
        settings.bold = !settings.bold;
        // Always load both weights if available
        await loadFont(settings.fontFamily);
        updateToggleButtons();
        draw();
    });

    document.getElementById("italicToggle").addEventListener("click", e => {
        settings.italic = !settings.italic;
        updateToggleButtons();
        draw();
    });

    function updateToggleButtons() {
        const boldBtn = document.getElementById("boldToggle");
        const italicBtn = document.getElementById("italicToggle");
        boldBtn.classList.toggle("active", settings.bold);
        italicBtn.classList.toggle("active", settings.italic);
        boldBtn.innerHTML = settings.bold ? 'Bold <span class="checkmark">✔</span>' : 'Bold';
        italicBtn.innerHTML = settings.italic ? 'Italic <span class="checkmark">✔</span>' : 'Italic';
    }

    // Initialize toggle button states on load
    updateToggleButtons();

    document.getElementById("imageScale").addEventListener("input", () => {
        settings.scale = parseFloat(document.getElementById("imageScale").value);
        draw();
    });
    document.getElementById("darkening").addEventListener("input", () => {
        settings.darkening = parseFloat(document.getElementById("darkening").value);
        draw();
    });
    document.getElementById("titleText").addEventListener("input", () => {
        settings.title = document.getElementById("titleText").value;
        draw();
    });
    document.getElementById("textColor").addEventListener("input", () => {
        settings.textColor = document.getElementById("textColor").value;
        draw();
    });
    document.getElementById("sectionColor").addEventListener("input", () => {
        settings.sectionColor = document.getElementById("sectionColor").value;
        draw();
    });
    document.getElementById("gradientAmount").addEventListener("input", () => {
        settings.gradientAmount = parseFloat(document.getElementById("gradientAmount").value);
        draw();
    });
    document.getElementById("gradientSize").addEventListener("input", () => {
        settings.gradientSize = parseFloat(document.getElementById("gradientSize").value);
        draw();
    });
    document.getElementById("glowAmount").addEventListener("input", () => {
        settings.glowAmount = parseFloat(document.getElementById("glowAmount").value);
        draw();
    });
    document.getElementById("glowLightness").addEventListener("input", () => {
        settings.glowLightness = parseFloat(document.getElementById("glowLightness").value);
        draw();
    });

    // Show/hide gradient size for fill only
    function updateGradientSizeVisibility() {
        const gradientSizeInput = document.getElementById("gradientSize");
        const gradientSizeLabel = gradientSizeInput.previousElementSibling;
        if (settings.overlayType === "fill") {
            gradientSizeInput.style.display = "none";
            gradientSizeLabel.style.display = "none";
        } else {
            gradientSizeInput.style.display = "";
            gradientSizeLabel.style.display = "";
        }
    }

    document.getElementById("overlayType").addEventListener("change", e => {
    settings.overlayType = e.target.value;
    updateGradientSizeVisibility();
    draw();
    });

    updateGradientSizeVisibility();

    async function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (img.src) {
            // Always maintain aspect ratio, scale to fill canvas in one dimension
            const scale = baseScale * settings.scale;
            const iw = img.width * scale;
            const ih = img.height * scale;
            // Center and apply drag offset
            const x = (canvas.width - iw) / 2 + settings.posX * canvas.width;
            const y = (canvas.height - ih) / 2 + settings.posY * canvas.height;
            ctx.drawImage(img, x, y, iw, ih);
        }

        if (settings.darkening > 0) {
            ctx.fillStyle = `rgba(0,0,0,${settings.darkening})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Overlay logic
        if (settings.overlayType === "fill" && settings.gradientAmount > 0) {
            ctx.fillStyle = settings.sectionColor;
            ctx.globalAlpha = settings.gradientAmount;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalAlpha = 1;
        } else if (settings.gradientAmount > 0) {
            let grad;
            const colorFull = settings.sectionColor + Math.floor(settings.gradientAmount * 255).toString(16).padStart(2, "0");
            const colorFade = settings.sectionColor + "00";
            switch (settings.overlayType) {
                case "gradient-horizontal": {
                    const size = settings.gradientSize / 2;
                    grad = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2);
                    grad.addColorStop(0.5 - size, colorFade);
                    grad.addColorStop(0.5, colorFull);
                    grad.addColorStop(0.5 + size, colorFade);
                    break;
                }
                case "gradient-vertical": {
                    const size = settings.gradientSize / 2;
                    grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
                    grad.addColorStop(0.5 - size, colorFade);
                    grad.addColorStop(0.5, colorFull);
                    grad.addColorStop(0.5 + size, colorFade);
                    break;
                }
                case "gradient-bottom": {
                    grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - settings.gradientSize * canvas.height);
                    grad.addColorStop(0, colorFull);
                    grad.addColorStop(1, colorFade);
                    break;
                }
                case "gradient-top": {
                    grad = ctx.createLinearGradient(0, 0, 0, settings.gradientSize * canvas.height);
                    grad.addColorStop(0, colorFull);
                    grad.addColorStop(1, colorFade);
                    break;
                }
                case "gradient-left": {
                    grad = ctx.createLinearGradient(0, 0, settings.gradientSize * canvas.width, 0);
                    grad.addColorStop(0, colorFull);
                    grad.addColorStop(1, colorFade);
                    break;
                }
                case "gradient-right": {
                    grad = ctx.createLinearGradient(canvas.width, 0, canvas.width - settings.gradientSize * canvas.width, 0);
                    grad.addColorStop(0, colorFull);
                    grad.addColorStop(1, colorFade);
                    break;
                }
                case "gradient-radial": {
                    // Oblong radial: draw to temp canvas, stretch horizontally
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = canvas.width / 2;
                    tempCanvas.height = canvas.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    const r = settings.gradientSize * tempCanvas.height;
                    const gradRadial = tempCtx.createRadialGradient(tempCanvas.width / 2, tempCanvas.height / 2, 0, tempCanvas.width / 2, tempCanvas.height / 2, r);
                    gradRadial.addColorStop(0, colorFull);
                    gradRadial.addColorStop(1, colorFade);
                    tempCtx.fillStyle = gradRadial;
                    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
                    // Stretch horizontally 2x
                    ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width, tempCanvas.height, 0, 0, canvas.width, canvas.height);
                    grad = null;
                    break;
                }
            }
            if (grad) {
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        // Wait for font to load before drawing text
        const fontSize = settings.fontSize;
        const weight = settings.bold ? "700" : "400";
        const style = settings.italic ? "italic" : "normal";
        const family = settings.fontFamily || "Noto Sans";
        const fontStr = `${style} normal ${weight} ${fontSize}px "${family}"`;
        await document.fonts.load(fontStr);
        ctx.font = fontStr;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = settings.textColor;
        ctx.shadowColor = lightenColor(settings.sectionColor, settings.glowLightness);
        ctx.shadowBlur = settings.glowAmount;
        ctx.fillText(settings.title, canvas.width / 2, canvas.height / 2);
        ctx.shadowBlur = 0;
    }

    function lightenColor(hex, amount = settings.glowLightness) {
        let r = parseInt(hex.slice(1, 3), 16);
        let g = parseInt(hex.slice(3, 5), 16);
        let b = parseInt(hex.slice(5, 7), 16);
        r /= 255; g /= 255; b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
            let d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        l = Math.min(1, l + amount);
        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        let p = 2 * l - q;
        r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
        g = Math.round(hue2rgb(p, q, h) * 255);
        b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
        return `rgb(${r},${g},${b})`;
    }

    document.getElementById("exportBtn").addEventListener("click", () => {
        // Create a temporary canvas at half the size
        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = canvas.width / 2;
        exportCanvas.height = canvas.height / 2;
        const exportCtx = exportCanvas.getContext("2d");
        // Draw the main canvas scaled down
        exportCtx.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
        const link = document.createElement("a");
        link.download = settings.title.replace(/\s+/g, "_") + ".png";
        link.href = exportCanvas.toDataURL();
        link.click();
    });
});