// Check authentication before proceeding
if (localStorage.getItem("isAuthenticated") !== "true") {
    window.location.href = "login.html";
    throw new Error("User not authenticated. Redirecting to login.");
}

document.addEventListener("DOMContentLoaded", () => {
    // Check if ZXing library is loaded with detailed error handling
    if (typeof ZXing === "undefined") {
        console.error("ZXing library not loaded. Possible causes: script not included, network issue, or blocked by browser.");
        alert("Scanner unavailable: ZXing library failed to load. Please ensure the script is included and reload the page.");
        // Log additional context for debugging
        console.log("Check if <script src='https://unpkg.com/@zxing/library@latest'></script> is in your HTML before script.js");
        return;
    } else {
        console.log("ZXing library loaded successfully.");
    }

    const elements = {
        video: document.getElementById("video"),
        result: document.getElementById("result"),
        startScannerBtn: document.getElementById("start-scanner"),
        stopScannerBtn: document.getElementById("stop-scanner"),
        progressBar: document.getElementById("budget-progress"),
        remainingAmount: document.getElementById("remaining-amount"),
        spentAmount: document.getElementById("spent-amount"),
        scannedItems: document.getElementById("scanned-items"),
        iqTitle: document.querySelector(".iq-title"),
        logoutBtn: document.getElementById("logout-btn"),
        userGreeting: document.getElementById("user-greeting"),
        productCount: document.getElementById("product-count"),
        searchInput: document.getElementById("cart-search"),
        searchBtn: document.getElementById("search-btn"),
        checkoutBtn: document.getElementById("checkout-btn"),
        checkoutPage: document.getElementById("checkout-page"),
        checkoutCartList: document.getElementById("checkout-cart-list"),
        checkoutTotal: document.getElementById("checkout-total"),
        proceedCheckoutBtn: document.getElementById("proceed-checkout"),
        closeCheckoutBtn: document.querySelector(".close-checkout"),
        upiOptionsContainer: document.getElementById("upi-options"),
        upiOptions: document.querySelectorAll(".upi-option")
    };

    let videoStream = null;
    let codeReader = null;
    let totalBudget = parseFloat(localStorage.getItem("totalBudget")) || 0;
    let spent = parseFloat(localStorage.getItem("spent")) || 0;

    // Display greeting
    const username = localStorage.getItem("username");
    if (username) {
        elements.userGreeting.textContent = `Hi, ${username}`;
    }

    elements.video.style.borderRadius = "8px";
    elements.video.style.border = "none";

    // Initialize UI from localStorage on reload
    updateProgressBar();
    loadCart();

    setTimeout(() => {
        if (localStorage.getItem("totalBudget")) {
            displayBudgetChoicePopup();
        } else {
            createBudgetWidget();
        }
    }, 4000);

    elements.logoutBtn.addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });

    function displayBudgetChoicePopup() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.backdropFilter = "blur(5px)";
        overlay.style.zIndex = "1000";
        document.body.appendChild(overlay);

        const popup = document.createElement("div");
        popup.style.position = "fixed";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.backgroundColor = "white";
        popup.style.padding = "20px";
        popup.style.borderRadius = "8px";
        popup.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        popup.style.zIndex = "1001";
        popup.innerHTML = `
            <h2>Load Previous Budget?</h2>
            <p>Would you like to load your previous budget?</p>
            <button id="load-previous-budget" style="padding: 8px 15px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">Yes, Load Previous</button>
            <button id="enter-new-budget" style="padding: 8px 15px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">No, Enter New</button>
        `;
        document.body.appendChild(popup);

        document.getElementById("load-previous-budget").addEventListener("click", () => {
            totalBudget = parseFloat(localStorage.getItem("totalBudget"));
            spent = parseFloat(localStorage.getItem("spent"));
            loadCart();
            updateProgressBar();
            popup.remove();
            overlay.remove();
        });

        document.getElementById("enter-new-budget").addEventListener("click", () => {
            localStorage.removeItem("totalBudget");
            localStorage.removeItem("spent");
            localStorage.removeItem("cart");
            totalBudget = 0;
            spent = 0;
            elements.scannedItems.innerHTML = "";
            updateProgressBar();
            updateProductCount();
            popup.remove();
            overlay.remove();
            createBudgetWidget();
        });
    }

    async function startScanner() {
        // Check if mediaDevices API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("MediaDevices API not supported. Browser or device may not support camera access.");
            alert("Scanner unavailable: Camera not supported by this browser or device.");
            return;
        }

        // Check if running in a secure context (HTTPS)
        if (window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
            console.error("Camera access requires HTTPS. Current protocol:", window.location.protocol);
            alert("Scanner unavailable: Camera access requires HTTPS. Please deploy on a secure server.");
            return;
        }

        try {
            console.log("Requesting camera access...");
            videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            console.log("Camera access granted. Starting video stream.");
            elements.video.srcObject = videoStream;
            elements.video.style.display = "block";
            elements.result.textContent = "Scanning...";
            elements.result.classList.add("scanning");

            codeReader = new ZXing.BrowserMultiFormatReader();
            console.log("Starting ZXing code reader...");
            codeReader.decodeFromVideoDevice(null, "video", (result, err) => {
                if (result) {
                    console.log("Barcode scanned successfully:", result.text);
                    elements.result.textContent = `Scanned: ${result.text}`;
                    elements.result.classList.remove("scanning");
                    elements.video.style.border = "5px solid #4caf50";
                    fetchProductDetails(result.text);
                }
                if (err && !(err instanceof ZXing.NotFoundException)) {
                    console.error("Unexpected scan error:", err.name, err.message);
                } else if (err instanceof ZXing.NotFoundException) {
                    elements.video.style.border = "5px solid #f44336";
                    elements.result.textContent = "Product not found.";
                }
            });
        } catch (error) {
            console.error("Camera access failed:", error.name, error.message);
            let errorMessage = "Scanner unavailable: ";
            if (error.name === "NotAllowedError") {
                errorMessage += "Camera permission denied. Please allow camera access in browser settings.";
            } else if (error.name === "NotFoundError") {
                errorMessage += "No camera found on this device.";
            } else if (error.name === "SecurityError") {
                errorMessage += "HTTPS required for camera access.";
            } else {
                errorMessage += `Unknown error - ${error.message}.`;
            }
            alert(errorMessage);
            stopScanner();
        }
    }

    function stopScanner() {
        if (codeReader) {
            console.log("Stopping ZXing code reader...");
            codeReader.reset();
            codeReader = null;
        }
        if (videoStream) {
            console.log("Stopping video stream...");
            videoStream.getTracks().forEach(track => track.stop());
            elements.video.srcObject = null;
            videoStream = null;
        }
        elements.video.style.display = "none";
        elements.result.textContent = "Scan a BARCODE";
        elements.result.classList.remove("scanning");
        elements.video.style.border = "none";
    }

    async function fetchProductDetails(barcode) {
        try {
            const response = await fetch("https://api.jsonbin.io/v3/qs/67d8fc638a456b796678211e");
            const data = await response.json();
            const products = data.record.products;
            const product = products.find(item => item.barcode === barcode);
            if (product) addToCart(product);
            else alert("Product not found.");
        } catch (error) {
            console.error("Fetch error:", error);
            alert("Failed to fetch product.");
        }
    }

    function addToCart(product) {
        const existingItem = Array.from(elements.scannedItems.children).find(li => li.dataset.name === product.name);
        if (existingItem) {
            updateQuantity(existingItem, 1, product.price);
        } else {
            const li = document.createElement("li");
            li.dataset.name = product.name;
            li.setAttribute("role", "listitem");
            li.setAttribute("aria-label", `${product.name}, price ₹${product.price.toFixed(2)}`);
            li.innerHTML = `
                <div class="cart-item-content">
                    <span class="product-name">${product.name}</span>
                    <div>
                        <div class="quantity-controls">
                            <button class="decrease">-</button>
                            <span class="quantity">1</span>
                            <button class="increase">+</button>
                        </div>
                        <span class="price">₹${product.price.toFixed(2)}</span>
                        <button class="delete-button">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
            elements.scannedItems.appendChild(li);

            li.querySelector(".increase").addEventListener("click", () => updateQuantity(li, 1, product.price));
            li.querySelector(".decrease").addEventListener("click", () => updateQuantity(li, -1, product.price));
            li.querySelector(".delete-button").addEventListener("click", () => {
                updateSpentAmount(-(parseFloat(li.querySelector(".quantity").textContent) * product.price));
                li.remove();
                saveCart();
                updateProductCount();
            });
            updateSpentAmount(product.price);
            saveCart();
            updateProductCount();
        }
    }

    function updateQuantity(item, change, price) {
        let newSpent = spent + (change * price);
        if (newSpent > totalBudget && totalBudget > 0) {
            displayMaxBudgetPopup();
            return;
        }

        const quantitySpan = item.querySelector(".quantity");
        let quantity = parseInt(quantitySpan.textContent) + change;
        if (quantity < 1) return;
        quantitySpan.textContent = quantity;
        item.querySelector(".price").textContent = `₹${(price * quantity).toFixed(2)}`;
        updateSpentAmount(change * price);
        saveCart();
    }

    function updateSpentAmount(amount) {
        const newSpent = spent + amount;
        if (newSpent < 0) return;
        if (newSpent > totalBudget && totalBudget > 0) {
            displayMaxBudgetPopup();
            return;
        }
        spent = newSpent;
        localStorage.setItem("spent", spent.toString());
        updateProgressBar();
    }

    function updateProgressBar() {
        const remaining = Math.max(totalBudget - spent, 0);
        elements.remainingAmount.textContent = remaining.toFixed(2);
        elements.spentAmount.textContent = spent.toFixed(2);
        const percentage = totalBudget ? (spent / totalBudget) * 100 : 0;
        elements.progressBar.setAttribute("aria-valuenow", percentage.toString());
        animateProgressBar(percentage);

        const progressContainer = elements.progressBar.parentElement;
        progressContainer.className = "progress-container";
        if (percentage >= 90) progressContainer.classList.add("red");
        else if (percentage >= 80) progressContainer.classList.add("orange");
        else if (percentage >= 50) progressContainer.classList.add("yellow");
        else progressContainer.classList.add("green");

        localStorage.setItem("progressBarValue", percentage.toString());
        localStorage.setItem("remainingAmount", remaining.toFixed(2));
        localStorage.setItem("spentAmount", spent.toFixed(2));
    }

    function animateProgressBar(target) {
        let current = parseFloat(elements.progressBar.value) || 0;
        const duration = 300;
        const start = performance.now();

        function step(timestamp) {
            const elapsed = timestamp - start;
            const progress = Math.min(elapsed / duration, 1);
            elements.progressBar.value = current + (target - current) * progress;
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    function animateIQColors(element) {
        const colors = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"];
        let index = 0;
        setInterval(() => {
            element.style.color = colors[index];
            index = (index + 1) % colors.length;
        }, 1000);
    }

    function displayMaxBudgetPopup() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.backdropFilter = "blur(5px)";
        overlay.style.zIndex = "1000";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.3s ease";

        const popup = document.createElement("div");
        popup.style.backgroundColor = "white";
        popup.style.padding = "20px";
        popup.style.borderRadius = "8px";
        popup.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        popup.style.textAlign = "center";

        popup.innerHTML = `
            <h2>Budget Exceeded!</h2>
            <p>Limit: ₹${totalBudget.toFixed(2)}</p>
            <p>You have reached your maximum budget limit.</p>
            <button id="increase-budget" style="padding: 8px 15px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">Increase Budget</button>
            <button id="close-popup" style="padding: 8px 15px; background-color: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left:10px">OK</button>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = "1";
        }, 10);

        overlay.querySelector("#close-popup").addEventListener("click", () => {
            overlay.style.opacity = "0";
            setTimeout(() => {
                overlay.remove();
            }, 300);
        });

        overlay.querySelector("#increase-budget").addEventListener("click", () => {
            overlay.remove();
            createIncreaseBudgetWidget();
        });
    }

    function createIncreaseBudgetWidget() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.backdropFilter = "blur(5px)";
        overlay.style.zIndex = "1001";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.3s ease";

        const widget = document.createElement("div");
        widget.style.backgroundColor = "white";
        widget.style.padding = "20px";
        widget.style.borderRadius = "8px";
        widget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        widget.style.textAlign = "center";

        widget.innerHTML = `
            <h2>Increase Your Budget</h2>
            <input type="number" id="increase-budget-input" placeholder="Enter new budget" style="padding: 8px; margin-bottom: 10px; width: 200px; border-radius: 4px; border: 1px solid #ccc;">
            <p id="budget-error" style="color: red; display: none;"></p>
            <button id="set-increased-budget" style="padding: 8px 15px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">Set New Budget</button>
        `;

        overlay.appendChild(widget);
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.style.opacity = "1";
        }, 10);

        const budgetInput = document.getElementById("increase-budget-input");
        const budgetButton = document.getElementById("set-increased-budget");
        const budgetError = document.getElementById("budget-error");

        budgetButton.addEventListener("click", () => {
            const newBudget = parseFloat(budgetInput.value);
            if (isNaN(newBudget) || newBudget <= totalBudget) {
                budgetError.textContent = "Please enter a valid budget amount";
                budgetError.style.display = "block";
                return;
            }

            budgetError.style.display = "none";
            totalBudget = newBudget;
            localStorage.setItem("totalBudget", totalBudget.toString());
            updateProgressBar();
            overlay.style.opacity = "0";
            setTimeout(() => {
                overlay.remove();
            }, 300);
        });
    }

    function createBudgetWidget() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.backdropFilter = "blur(5px)";
        overlay.style.zIndex = "999";
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.3s ease";
        document.body.appendChild(overlay);

        const widget = document.createElement("div");
        widget.style.position = "fixed";
        widget.style.top = "50%";
        widget.style.left = "50%";
        widget.style.transform = "translate(-50%, -50%)";
        widget.style.backgroundColor = "white";
        widget.style.padding = "20px";
        widget.style.borderRadius = "8px";
        widget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.2)";
        widget.style.zIndex = "1000";
        widget.style.transition = "opacity 0.3s ease";
        widget.style.opacity = "0";

        widget.innerHTML = `
            <h2>Enter Your Budget</h2>
            <input type="number" id="budget-widget-input" placeholder="Enter budget" style="padding: 8px; margin-bottom: 10px; width: 200px; border-radius: 4px; border: 1px solid #ccc;">
            <button id="budget-widget-button" style="padding: 8px 15px; background-color: #4caf50; color: white; border: none; border-radius: 4px; cursor: pointer;">Set Budget</button>
        `;

        document.body.appendChild(widget);

        setTimeout(() => {
            overlay.style.opacity = "1";
            widget.style.opacity = "1";
        }, 10);

        const budgetInput = document.getElementById("budget-widget-input");
        const budgetButton = document.getElementById("budget-widget-button");

        budgetButton.addEventListener("click", () => setBudget(budgetInput, overlay, widget));
        budgetInput.addEventListener("keypress", (e) => e.key === "Enter" && setBudget(budgetInput, overlay, widget));
    }

    function setBudget(input, overlay, widget) {
        const budgetValue = parseFloat(input.value);
        if (isNaN(budgetValue) || budgetValue <= 0) {
            alert("Please enter a valid budget amount.");
            return;
        }
        totalBudget = budgetValue;
        localStorage.setItem("totalBudget", totalBudget.toString());
        localStorage.setItem("spent", "0");
        spent = 0;
        updateProgressBar();
        overlay.style.opacity = "0";
        widget.style.opacity = "0";
        setTimeout(() => {
            overlay.remove();
            widget.remove();
        }, 300);
    }

    function displaySpendIQ() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.backdropFilter = "blur(5px)";
        overlay.style.zIndex = "999";
        overlay.style.opacity = "0";
        overlay.style.transition = "opacity 0.5s ease";
        document.body.appendChild(overlay);

        const spendIQ = document.createElement("div");
        spendIQ.style.position = "fixed";
        spendIQ.style.top = "50%";
        spendIQ.style.left = "50%";
        spendIQ.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
        spendIQ.style.transform = "translate(-50%, -50%)";
        spendIQ.style.zIndex = "1000";
        spendIQ.style.opacity = "0";
        spendIQ.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        spendIQ.innerHTML = `
            <h1 style="text-align: center; margin-bottom: 20px; font-size: 100px; font-weight: 800; color: white;">
                Spend<span id="iq-colors">IQ</span>
            </h1>
            <p style="text-align: center; font-size: 1.5em; color: white; font-weight: 500;">Your Intelligent Shopping Companion</p>
        `;
        document.body.appendChild(spendIQ);

        const iqColors = document.getElementById("iq-colors");
        const colors = ["#3498db", "#e74c3c", "#2ecc71", "#f39c12", "#9b59b6"];
        let colorIndex = 0;

        function changeColors() {
            iqColors.style.transition = "color 2s ease";
            iqColors.style.color = colors[colorIndex];
            colorIndex = (colorIndex + 1) % colors.length;
        }

        changeColors();
        const colorInterval = setInterval(changeColors, 500);

        setTimeout(() => {
            overlay.style.opacity = "1";
            spendIQ.style.opacity = "1";
            spendIQ.style.transform = "translate(-50%, -50%) scale(1)";
        }, 10);

        setTimeout(() => {
            overlay.style.opacity = "0";
            spendIQ.style.opacity = "0";
            spendIQ.style.transform = "translate(-50%, -50%) scale(0.9)";
            clearInterval(colorInterval);
            setTimeout(() => {
                overlay.remove();
                spendIQ.remove();
            }, 500);
        }, 4000);
    }

    function saveCart() {
        const cartItems = Array.from(elements.scannedItems.children).map(item => {
            return {
                name: item.dataset.name,
                price: parseFloat(item.querySelector(".price").textContent.replace("₹", "")) / parseInt(item.querySelector(".quantity").textContent),
                quantity: parseInt(item.querySelector(".quantity").textContent)
            };
        });
        localStorage.setItem("cart", JSON.stringify(cartItems));
    }

    function loadCart() {
        const cartItems = JSON.parse(localStorage.getItem("cart")) || [];
        elements.scannedItems.innerHTML = "";

        cartItems.forEach(item => {
            const li = document.createElement("li");
            li.dataset.name = item.name;
            li.setAttribute("role", "listitem");
            li.setAttribute("aria-label", `${item.name}, price ₹${(item.price * item.quantity).toFixed(2)}`);
            li.innerHTML = `
                <div class="cart-item-content">
                    <span class="product-name">${item.name}</span>
                    <div>
                        <div class="quantity-controls">
                            <button class="decrease">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="increase">+</button>
                        </div>
                        <span class="price">₹${(item.price * item.quantity).toFixed(2)}</span>
                        <button class="delete-button"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
            `;
            elements.scannedItems.appendChild(li);

            li.querySelector(".increase").addEventListener("click", () => updateQuantity(li, 1, item.price));
            li.querySelector(".decrease").addEventListener("click", () => updateQuantity(li, -1, item.price));
            li.querySelector(".delete-button").addEventListener("click", () => {
                updateSpentAmount(-(item.price * parseInt(li.querySelector(".quantity").textContent)));
                li.remove();
                saveCart();
                updateProductCount();
            });
        });
        updateProductCount();
    }

    if (localStorage.getItem("progressBarValue")) {
        elements.progressBar.setAttribute("aria-valuenow", localStorage.getItem("progressBarValue"));
        elements.progressBar.value = localStorage.getItem("progressBarValue");
        elements.remainingAmount.textContent = localStorage.getItem("remainingAmount");
        elements.spentAmount.textContent = localStorage.getItem("spentAmount");
        const progressContainer = elements.progressBar.parentElement;
        progressContainer.className = "progress-container";
        let percentage = parseFloat(localStorage.getItem("progressBarValue"));
        if (percentage >= 90) progressContainer.classList.add("red");
        else if (percentage >= 80) progressContainer.classList.add("orange");
        else if (percentage >= 50) progressContainer.classList.add("yellow");
        else progressContainer.classList.add("green");
    }

    function searchCart() {
        const query = elements.searchInput.value.trim().toLowerCase();
        const items = elements.scannedItems.children;
        Array.from(items).forEach(item => {
            const name = item.dataset.name.toLowerCase();
            if (query === "") {
                item.style.display = "block";
            } else {
                item.style.display = name.includes(query) ? "block" : "none";
            }
        });
        updateProductCount();
    }

    function updateProductCount() {
        const visibleItems = Array.from(elements.scannedItems.children).filter(item => item.style.display !== "none");
        elements.productCount.textContent = visibleItems.length;
    }

    // Checkout Functionality (Updated with fix for null check)
    function handleCheckout() {
        if (spent === 0) {
            alert("Your cart is empty!");
            return;
        }

        // Check if required elements exist
        if (!elements.checkoutPage || !elements.checkoutCartList || !elements.checkoutTotal || !elements.proceedCheckoutBtn) {
            console.error("Checkout elements not found in DOM:", {
                checkoutPage: !!elements.checkoutPage,
                checkoutCartList: !!elements.checkoutCartList,
                checkoutTotal: !!elements.checkoutTotal,
                proceedCheckoutBtn: !!elements.proceedCheckoutBtn
            });
            alert("Checkout feature is unavailable due to missing elements.");
            return;
        }

        // Populate cart list as a bill
        const cartItems = JSON.parse(localStorage.getItem("cart")) || [];
        elements.checkoutCartList.innerHTML = "";
        cartItems.forEach(item => {
            const li = document.createElement("li");
            li.innerHTML = `${item.name} (x${item.quantity}) <span>₹${(item.price * item.quantity).toFixed(2)}</span>`;
            elements.checkoutCartList.appendChild(li);
        });

        // Update total
        elements.checkoutTotal.textContent = `Total: ₹${spent.toFixed(2)}`;

        // Show checkout page with bill view
        elements.checkoutPage.style.display = "block";
        elements.upiOptionsContainer.style.display = "none"; // Hide UPI initially
        elements.proceedCheckoutBtn.style.display = "inline-block"; // Show proceed button

        // Add Back button dynamically if not already present
        setTimeout(() => elements.checkoutPage.classList.add("show"), 10); // Trigger animation
    }

    // Proceed to payment.html
    function proceedToPayment() {
        window.location.href = "payment.html";
    }

    function closeCheckout() {
        if (elements.checkoutPage) {
            elements.checkoutPage.classList.remove("show");
            setTimeout(() => {
                elements.checkoutPage.style.display = "none";
                if (elements.checkoutCartList) elements.checkoutCartList.style.display = "block"; // Reset for next open
                if (elements.checkoutCartList) elements.checkoutCartList.style.maxHeight = "40vh";
                if (elements.checkoutTotal) elements.checkoutTotal.style.display = "block";
                if (elements.checkoutPage.querySelector("h2")) elements.checkoutPage.querySelector("h2").textContent = "Your Cart";
                if (elements.upiOptionsContainer) elements.upiOptionsContainer.style.maxHeight = "0"; // Reset UPI height
            }, 400); // Match transition duration
        }
    }

    // Retained from previous code but unused due to redirect
    function showUPIOptions() {
        if (elements.checkoutCartList) elements.checkoutCartList.style.maxHeight = "0";
        if (elements.checkoutTotal) elements.checkoutTotal.style.display = "none";
        if (elements.proceedCheckoutBtn) elements.proceedCheckoutBtn.style.display = "none";
        if (elements.checkoutPage.querySelector("h2")) elements.checkoutPage.querySelector("h2").textContent = "Select UPI Payment Method";
        if (elements.upiOptionsContainer) elements.upiOptionsContainer.style.display = "flex";
        setTimeout(() => {
            if (elements.checkoutCartList) elements.checkoutCartList.style.display = "none"; // Fully hide after animation
            if (elements.upiOptionsContainer) elements.upiOptionsContainer.style.maxHeight = "40vh"; // Expand UPI options
        }, 500); // Match transition duration
    }

    // Retained from previous code but unused due to redirect
    function selectUPI(method) {
        alert(`Proceeding to payment of ₹${spent.toFixed(2)} via ${method}. (Payment integration TBD)`);
        closeCheckout();
    }

    // Event Listeners
    elements.startScannerBtn.addEventListener("click", startScanner);
    elements.stopScannerBtn.addEventListener("click", stopScanner);
    elements.searchInput.addEventListener("input", searchCart);
    elements.searchBtn.addEventListener("click", searchCart);
    elements.checkoutBtn.addEventListener("click", handleCheckout);
    elements.proceedCheckoutBtn.addEventListener("click", proceedToPayment);
    elements.closeCheckoutBtn.addEventListener("click", closeCheckout);
    elements.upiOptions.forEach(option => {
        option.addEventListener("click", () => {
            const method = option.getAttribute("data-method");
            selectUPI(method);
        });
    });

    displaySpendIQ();
    animateIQColors(elements.iqTitle);

    loadCart();
});