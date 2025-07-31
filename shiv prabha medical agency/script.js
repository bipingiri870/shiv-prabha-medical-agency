import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

// --- Firebase Configuration ---
// This should be the same config as your admin.js
const firebaseConfig = {
  apiKey: "AIzaSyDPqm6RClAajj5pwwZyu93qGHCWjCj1wgo",
  authDomain: "shiv-prabha-medical-agency.firebaseapp.com",
  projectId: "shiv-prabha-medical-agency",
  storageBucket: "shiv-prabha-medical-agency.firebasestorage.app",
  messagingSenderId: "47024544048",
  appId: "1:47024544048:web:d1ef8ae4ff5eaea41cd0f5",
  measurementId: "G-CH5EPX68PX"
};

let db, auth, storage;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
} catch (e) {
    console.error("Firebase initialization failed:", e);
    alert("Firebase is not configured correctly.");
}

// --- Authentication for Customers (Anonymous) ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Customer is signed in anonymously:", user.uid);
        loadMedicines(); // Start loading products
    } else {
        try {
            await signInAnonymously(auth);
        } catch (error) {
            console.error("Anonymous sign-in failed:", error);
            customAlert("Could not connect to the service. Please refresh the page.");
        }
    }
});


// --- App State ---
let medicines = [];
let cart = [];
const ownerWhatsApp = "919942523385"; // Your WhatsApp number
let unsubscribeMedicines = null; 
let expiryAlertSent = false;

// --- DOM Elements ---
const medicineListEl = document.getElementById('medicine-list');
const cartItemsEl = document.getElementById('cart-items');
const totalPriceEl = document.getElementById('total-price');
const customerDetailsForm = document.getElementById('customer-details-form');
const alertModal = document.getElementById('alert-modal');
const alertMessageEl = document.getElementById('alert-message');
const alertOkBtn = document.getElementById('alert-ok-btn');
const productDetailModal = document.getElementById('product-detail-modal');
const productDetailContent = document.getElementById('product-detail-content');
const searchBar = document.getElementById('search-bar');


// --- Functions ---

function customAlert(message) {
    if (alertMessageEl && alertModal) {
        alertMessageEl.textContent = message;
        alertModal.style.display = 'block';
    }
}

if (alertOkBtn) {
    alertOkBtn.addEventListener('click', () => {
        alertModal.style.display = 'none';
    });
}


function loadMedicines() {
    if (!db) return;
    if (unsubscribeMedicines) unsubscribeMedicines(); 

    const medicinesCol = collection(db, "medicines");
    unsubscribeMedicines = onSnapshot(medicinesCol, (querySnapshot) => {
        medicines = [];
        querySnapshot.forEach((doc) => {
            medicines.push({ id: doc.id, ...doc.data() });
        });
        renderMedicines();
    }, (error) => {
        console.error("Error listening to medicines collection: ", error);
        if (error.code === 'permission-denied') {
            customAlert("Permission Denied: Could not read from the database. Please check your Firestore security rules.");
        } else {
            customAlert("Failed to load medicine data.");
        }
    });
}

function renderMedicines() {
    if (!medicineListEl || !searchBar) return;
    const searchTerm = searchBar.value.toLowerCase();
    const filteredMedicines = medicines.filter(med => med.name.toLowerCase().includes(searchTerm));

    medicineListEl.innerHTML = '';
    if (filteredMedicines.length === 0) {
         medicineListEl.innerHTML = `<p class="text-gray-500 col-span-full">${searchTerm ? 'No medicines match your search.' : 'No medicines in stock.'}</p>`;
         return;
    }
    filteredMedicines.forEach(med => {
        const stockColor = med.stock <= 10 ? 'text-red-500' : 'text-green-500';
        const card = document.createElement('div');
        card.className = 'product-card bg-white rounded-lg shadow hover:shadow-lg transition-shadow flex flex-col';
        card.dataset.id = med.id;
        card.innerHTML = `
            <img src="${med.imageUrl || 'https://placehold.co/300x300/e2e8f0/cccccc?text=No+Image'}" alt="${med.name}" class="w-full h-40 object-cover rounded-t-lg">
            <div class="p-4 flex flex-col flex-grow">
                <h3 class="text-lg font-semibold text-gray-900 flex-grow">${med.name}</h3>
                <p class="text-gray-600">₹${med.price.toFixed(2)}</p>
                <p class="text-sm font-medium ${stockColor}">Stock: ${med.stock}</p>
                ${med.expiryDate ? `<p class="text-sm text-gray-500">Expires: ${new Date(med.expiryDate).toLocaleDateString()}</p>` : ''}
                <button data-id="${med.id}" class="add-to-cart-btn-quick mt-3 w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 disabled:bg-gray-300" ${med.stock === 0 ? 'disabled' : ''}>
                    ${med.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
            </div>
        `;
        medicineListEl.appendChild(card);
    });
}

function addToCart(medicineId) {
    const medicine = medicines.find(m => m.id === medicineId);
    if (!medicine || medicine.stock <= 0) return;

    const cartItem = cart.find(item => item.id === medicineId);
    if (cartItem) {
        if (cartItem.quantity < medicine.stock) {
            cartItem.quantity++;
             customAlert(`${medicine.name} quantity updated in cart.`);
        } else {
            customAlert(`Cannot add more ${medicine.name}. Only ${medicine.stock} left in stock.`);
        }
    } else {
        cart.push({ ...medicine, quantity: 1 });
        customAlert(`${medicine.name} added to cart.`);
    }
    updateCart();
}

function updateCart() {
    if (!cartItemsEl || !totalPriceEl) return;
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
        cartItemsEl.innerHTML = '<p class="text-gray-500">Your cart is empty.</p>';
        totalPriceEl.textContent = '₹0.00';
        return;
    }

    let totalPrice = 0;
    cart.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'flex justify-between items-center mb-2';
        itemEl.innerHTML = `
            <div class="flex items-center gap-2">
                <img src="${item.imageUrl || 'https://placehold.co/40x40'}" class="w-10 h-10 object-cover rounded">
                <div>
                    <p class="font-semibold">${item.name}</p>
                    <div class="flex items-center text-sm text-gray-500">
                        ₹${item.price.toFixed(2)} x 
                        <input type="number" value="${item.quantity}" min="1" max="${item.stock}" data-id="${item.id}" class="quantity-input w-16 text-center border rounded ml-2">
                    </div>
                </div>
            </div>
            <button data-id="${item.id}" class="remove-from-cart-btn text-red-500 hover:text-red-700 font-bold p-1">X</button>
        `;
        cartItemsEl.appendChild(itemEl);
        totalPrice += item.price * item.quantity;
    });
    totalPriceEl.textContent = `₹${totalPrice.toFixed(2)}`;
}

function handleQuantityChange(medicineId, newQuantity) {
    const cartItem = cart.find(item => item.id === medicineId);
    if (!cartItem) return;

    const quantity = parseInt(newQuantity);
    
    if (isNaN(quantity) || quantity < 1) {
        // If invalid, revert to 1
        cartItem.quantity = 1;
    } else if (quantity > cartItem.stock) {
        // If more than stock, set to max stock
        customAlert(`Only ${cartItem.stock} of ${cartItem.name} available.`);
        cartItem.quantity = cartItem.stock;
    } else {
        cartItem.quantity = quantity;
    }
    
    updateCart();
}


function removeFromCart(medicineId) {
    cart = cart.filter(item => item.id !== medicineId);
    updateCart();
}

async function placeOrder(event) {
    event.preventDefault(); 
    const name = document.getElementById('customer-name').value.trim();
    const phone = document.getElementById('customer-phone').value.trim();
    const email = document.getElementById('customer-email').value.trim();
    const address = document.getElementById('customer-address').value.trim();

    if (cart.length === 0) { customAlert("Your cart is empty."); return; }
    if (!/^\d{10,}$/.test(phone)) { customAlert("Please enter a valid 10-digit phone number."); return; }

    const orderId = `SPMA-${Date.now()}`;
    let billText = `*Shiv Prabha Medical Agency*\n\n*Order ID:* ${orderId}\n*Customer:* ${name}\n*Phone:* ${phone}\n*Email:* ${email}\n*Address:* ${address}\n\n--- *Order Details* ---\n`;
    let totalPrice = 0;
    cart.forEach(item => {
        billText += `${item.name} (x${item.quantity}) - ₹${(item.price * item.quantity).toFixed(2)}\n`;
        totalPrice += item.price * item.quantity;
    });
    billText += `\n*Total Amount: ₹${totalPrice.toFixed(2)}*\n\nThank you for your order!`;

    if (!db) { customAlert("Database connection not available."); return; }
    const batch = writeBatch(db);
    const stockAlerts = [];
    cart.forEach(cartItem => {
        const medRef = doc(db, "medicines", cartItem.id);
        const originalMed = medicines.find(m => m.id === cartItem.id);
        const newStock = originalMed.stock - cartItem.quantity;
        batch.update(medRef, { stock: newStock });
        if (newStock <= 10 && originalMed.stock > 10) {
            stockAlerts.push(`${originalMed.name} is running low on stock (${newStock} left).`);
        }
    });

    try {
        await batch.commit();
        const ownerMessage = `*New Order Received!*\n\n${billText}`;
        const customerMessage = `Hi ${name}, your order from Shiv Prabha Medical Agency has been confirmed.\n\n${billText}`;
        if (stockAlerts.length > 0) {
            const stockAlertMessage = `*Stock Alert!*\n${stockAlerts.join('\n')}`;
            window.open(`https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(stockAlertMessage)}`, '_blank');
        }
        window.open(`https://wa.me/${ownerWhatsApp}?text=${encodeURIComponent(ownerMessage)}`, '_blank');
        window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(customerMessage)}`, '_blank');
        
        cart = [];
        updateCart();
        customerDetailsForm.reset();
        customAlert("Order placed successfully! Redirecting to WhatsApp.");
    } catch (error) {
        console.error("Error updating stock: ", error);
        customAlert("Failed to place order. Please try again.");
    }
}

function showProductDetail(medicineId) {
    const med = medicines.find(m => m.id === medicineId);
    if (!med) return;

    const stockColor = med.stock <= 10 ? 'text-red-500' : 'text-green-500';
    productDetailContent.innerHTML = `
        <span class="modal-close" id="close-detail-modal">&times;</span>
        <img src="${med.imageUrl || 'https://placehold.co/400x400/e2e8f0/cccccc?text=No+Image'}" alt="${med.name}" class="w-full h-64 object-cover rounded-lg mb-4">
        <h2 class="text-2xl font-bold mb-2">${med.name}</h2>
        <p class="text-gray-700 mb-4">${med.description || 'No description available.'}</p>
        <p class="text-2xl font-bold text-blue-600 mb-2">₹${med.price.toFixed(2)}</p>
        <p class="text-md font-medium ${stockColor} mb-4">Stock: ${med.stock}</p>
        ${med.expiryDate ? `<p class="text-md font-medium text-gray-600 mb-4">Expires: ${new Date(med.expiryDate).toLocaleDateString()}</p>` : ''}
        <button data-id="${med.id}" class="add-to-cart-btn-detail w-full bg-green-500 text-white py-3 rounded-lg text-lg font-semibold hover:bg-green-600 disabled:bg-gray-400" ${med.stock === 0 ? 'disabled' : ''}>
            ${med.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
        </button>
    `;
    productDetailModal.style.display = 'block';
}

function closeProductDetailModal() {
    if (productDetailModal) {
        productDetailModal.style.display = 'none';
    }
}

// --- Event Listeners ---
if (customerDetailsForm) {
    customerDetailsForm.addEventListener('submit', placeOrder);
}
if(searchBar) {
    searchBar.addEventListener('input', renderMedicines);
}
if(medicineListEl) {
    medicineListEl.addEventListener('click', (e) => {
        const card = e.target.closest('.product-card');
        const quickAddBtn = e.target.closest('.add-to-cart-btn-quick');

        if (quickAddBtn) {
            e.stopPropagation();
            addToCart(quickAddBtn.dataset.id);
        } else if (card) {
            showProductDetail(card.dataset.id);
        }
    });
}

if(cartItemsEl) {
    cartItemsEl.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-from-cart-btn');
        if (removeBtn) {
            removeFromCart(removeBtn.dataset.id);
        }
    });

    cartItemsEl.addEventListener('change', (e) => {
        if (e.target.classList.contains('quantity-input')) {
            handleQuantityChange(e.target.dataset.id, e.target.value);
        }
    });
}

if (productDetailModal) {
    productDetailModal.addEventListener('click', (e) => {
        if (e.target.id === 'close-detail-modal') {
            closeProductDetailModal();
        } else if (e.target.classList.contains('add-to-cart-btn-detail')) {
            addToCart(e.target.dataset.id);
            closeProductDetailModal();
        }
    });
}

window.onclick = function(event) {
    if (event.target == alertModal) {
        alertModal.style.display = "none";
    }
    if (event.target == productDetailModal) {
        closeProductDetailModal();
    }
}
