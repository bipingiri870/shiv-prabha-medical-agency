import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, writeBatch, addDoc, Timestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyDPqm6RClAajj5pwwZyu93qGHCWjCj1wgo",
  authDomain: "shiv-prabha-medical-agency.firebaseapp.com",
  projectId: "shiv-prabha-medical-agency",
  storageBucket: "shiv-prabha-medical-agency.firebasestorage.app",
  messagingSenderId: "47024544048",
  appId: "1:47024544048:web:d1ef8ae4ff5eaea41cd0f5",
  measurementId: "G-CH5EPX68PX"
};

let db, auth;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
} catch (e) {
    console.error("Firebase initialization failed:", e);
    alert("Could not connect to the database.");
}

// --- Auth Protection for Counter ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Admin authenticated. Loading counter...");
        preloadMedicines();
    } else {
        console.log("No user logged in. Redirecting to admin login.");
        window.location.href = 'admin.html';
    }
});

// --- DOM Elements ---
const billingTab = document.getElementById('billing-tab');
const historyTab = document.getElementById('history-tab');
const billingView = document.getElementById('billing-view');
const historyView = document.getElementById('history-view');
const barcodeInput = document.getElementById('barcode-input');
const scanBtnCounter = document.getElementById('scan-barcode-btn-counter');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const billingList = document.getElementById('billing-list');
const subtotalEl = document.getElementById('subtotal');
const grandTotalEl = document.getElementById('grand-total');
const finalizeBtn = document.getElementById('finalize-bill-btn');
const exportBtn = document.getElementById('export-tally-btn');
const newBillBtn = document.getElementById('new-bill-btn');
const historyList = document.getElementById('history-list');
const exportHistoryBtn = document.getElementById('export-history-tally-btn');

// --- App State ---
let currentBill = [];
let allMedicines = [];
let salesHistory = [];

// --- Tab Switching ---
billingTab.addEventListener('click', () => {
    billingView.classList.remove('hidden');
    historyView.classList.add('hidden');
    billingTab.classList.add('text-blue-600', 'border-blue-600');
    historyTab.classList.remove('text-blue-600', 'border-blue-600');
});

historyTab.addEventListener('click', () => {
    historyView.classList.remove('hidden');
    billingView.classList.add('hidden');
    historyTab.classList.add('text-blue-600', 'border-blue-600');
    billingTab.classList.remove('text-blue-600', 'border-blue-600');
    loadSalesHistory();
});


// --- Functions ---
async function preloadMedicines() {
    if (!db) return;
    const querySnapshot = await getDocs(collection(db, "medicines"));
    allMedicines = [];
    querySnapshot.forEach((doc) => {
        allMedicines.push({ id: doc.id, ...doc.data() });
    });
    console.log(`Preloaded ${allMedicines.length} medicines.`);
    barcodeInput.focus();
}

barcodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const barcodeValue = barcodeInput.value.trim();
        if (barcodeValue) {
            findAndAddItem(barcodeValue, 'barcode');
            barcodeInput.value = '';
        }
    }
});

scanBtnCounter.addEventListener('click', () => barcodeInput.focus());

searchInput.addEventListener('input', () => {
    console.log("Search input detected.");
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm.length < 2) {
        searchResults.innerHTML = '';
        searchResults.classList.add('hidden');
        return;
    }
    const matchingProducts = allMedicines.filter(med => 
        med.name.toLowerCase().includes(searchTerm) ||
        (med.description && med.description.toLowerCase().includes(searchTerm))
    );
    console.log(`Found ${matchingProducts.length} products for term: "${searchTerm}"`);
    renderSearchResults(matchingProducts);
});

function renderSearchResults(products) {
    searchResults.innerHTML = '';
    if (products.length === 0) {
        searchResults.classList.add('hidden');
        return;
    }
    products.forEach(product => {
        const resultEl = document.createElement('div');
        resultEl.className = 'search-result-item p-3 hover:bg-gray-100 cursor-pointer';
        resultEl.textContent = `${product.name} (Stock: ${product.stock})`;
        resultEl.dataset.id = product.id;
        searchResults.appendChild(resultEl);
    });
    searchResults.classList.remove('hidden');
}

searchResults.addEventListener('click', (e) => {
    console.log("Search result clicked.");
    const target = e.target.closest('.search-result-item');
    if (target && target.dataset.id) {
        findAndAddItem(target.dataset.id, 'id');
        searchInput.value = '';
        searchResults.classList.add('hidden');
    }
});

// Hide search results when clicking anywhere else on the page
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        searchResults.classList.add('hidden');
    }
});


function findAndAddItem(value, type) {
    let product;
    if (type === 'barcode') {
        product = allMedicines.find(med => med.barcode === value);
    } else if (type === 'id') {
        product = allMedicines.find(med => med.id === value);
    }
    if (product) addItemToBill(product);
    else alert("Product not found.");
}

function addItemToBill(product) {
    if (product.stock <= 0) {
        alert(`${product.name} is out of stock.`);
        return;
    }
    const existingItem = currentBill.find(item => item.id === product.id);
    if (existingItem) {
        if (existingItem.quantity < product.stock) existingItem.quantity++;
        else alert(`Maximum stock reached for ${product.name}.`);
    } else {
        currentBill.push({ ...product, quantity: 1, price: product.price });
    }
    renderBill();
}

function renderBill() {
    billingList.innerHTML = '';
    let subtotal = 0;
    currentBill.forEach(item => {
        const totalItemPrice = (item.price || 0) * (item.quantity || 0);
        subtotal += totalItemPrice;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap"><input type="number" value="${item.quantity}" min="1" max="${item.stock}" data-id="${item.id}" class="quantity-input w-16 text-center border rounded"></td>
            <td class="px-6 py-4 whitespace-nowrap"><input type="number" value="${item.price.toFixed(2)}" min="0" step="0.01" data-id="${item.id}" class="price-input w-24 text-center border rounded"></td>
            <td class="px-6 py-4 whitespace-nowrap">₹${totalItemPrice.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right"><button data-id="${item.id}" class="remove-item-btn text-red-500 hover:text-red-700">Remove</button></td>
        `;
        billingList.appendChild(row);
    });
    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    grandTotalEl.textContent = `₹${subtotal.toFixed(2)}`;
}

function updateTotals() {
    let subtotal = 0;
    currentBill.forEach(item => {
        subtotal += (item.price || 0) * (item.quantity || 0);
    });
    subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
    grandTotalEl.textContent = `₹${subtotal.toFixed(2)}`;
}

function handleBillClick(e) {
    if (e.target.classList.contains('remove-item-btn')) {
        currentBill = currentBill.filter(item => item.id !== e.target.dataset.id);
        renderBill();
    }
}

function handleBillInput(e) {
    const target = e.target;
    const itemId = target.dataset.id;
    const itemInBill = currentBill.find(item => item.id === itemId);
    if (!itemInBill) return;

    if (target.classList.contains('quantity-input')) {
        let newQty = parseInt(target.value);
        if (newQty > itemInBill.stock) {
            newQty = itemInBill.stock;
            alert(`Only ${itemInBill.stock} in stock.`);
            target.value = newQty;
        }
        itemInBill.quantity = isNaN(newQty) ? 0 : newQty;
    }

    if (target.classList.contains('price-input')) {
        let newPrice = parseFloat(target.value);
        itemInBill.price = isNaN(newPrice) ? 0 : newPrice;
    }

    const row = target.closest('tr');
    row.querySelector('td:nth-child(4)').textContent = `₹${(itemInBill.price * itemInBill.quantity).toFixed(2)}`;
    updateTotals();
}

function handleBillChange(e) {
    const target = e.target;
    const itemId = target.dataset.id;
    const itemInBill = currentBill.find(item => item.id === itemId);
    if (!itemInBill || !target.classList.contains('quantity-input')) return;
    if (itemInBill.quantity < 1 || isNaN(itemInBill.quantity)) {
        itemInBill.quantity = 1;
    }
    renderBill();
}

billingList.addEventListener('click', handleBillClick);
billingList.addEventListener('input', handleBillInput);
billingList.addEventListener('change', handleBillChange);

function startNewBill() {
    currentBill = [];
    renderBill();
    barcodeInput.focus();
}

newBillBtn.addEventListener('click', startNewBill);

function generatePrintableBill(bill, total) {
    let billHtml = `
        <style>
            body { font-family: sans-serif; margin: 20px; }
            h1 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .total { font-weight: bold; font-size: 1.2em; text-align: right; }
        </style>
        <h1>Shiv Prabha Medical Agency</h1>
        <p>Date: ${new Date().toLocaleString()}</p>
        <table>
            <thead>
                <tr>
                    <th>Item Name</th>
                    <th>Quantity</th>
                    <th>Rate</th>
                    <th>Amount</th>
                </tr>
            </thead>
            <tbody>
    `;

    bill.forEach(item => {
        billHtml += `
            <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>₹${item.price.toFixed(2)}</td>
                <td>₹${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
        `;
    });

    billHtml += `
            </tbody>
        </table>
        <p class="total">Grand Total: ₹${total.toFixed(2)}</p>
    `;
    return billHtml;
}

finalizeBtn.addEventListener('click', async () => {
    if (currentBill.length === 0) {
        alert("Please add items to the bill first.");
        return;
    }

    const batch = writeBatch(db);
    let grandTotal = 0;
    const saleItems = [];

    currentBill.forEach(item => {
        const newStock = item.stock - item.quantity;
        const medicineRef = doc(db, "medicines", item.id);
        batch.update(medicineRef, { stock: newStock });
        grandTotal += item.price * item.quantity;
        saleItems.push({ name: item.name, quantity: item.quantity, price: item.price });
    });
    
    const saleRecord = {
        createdAt: Timestamp.now(),
        totalAmount: grandTotal,
        items: saleItems
    };

    try {
        await addDoc(collection(db, "sales"), saleRecord);
        await batch.commit();
        console.log("Sale recorded and stock updated.");
        
        const printableBill = generatePrintableBill(currentBill, grandTotal);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(printableBill);
        printWindow.document.close();
        printWindow.print();
        
        startNewBill();
        await preloadMedicines();
    } catch (error) {
        console.error("Failed to finalize bill:", error);
        alert("Error finalizing bill. Please check your connection and security rules.");
    }
});

async function loadSalesHistory() {
    if (!db) return;
    const querySnapshot = await getDocs(collection(db, "sales"));
    salesHistory = [];
    querySnapshot.forEach((doc) => {
        salesHistory.push({ id: doc.id, ...doc.data() });
    });
    salesHistory.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()); // Sort newest first
    renderSalesHistory();
}

function renderSalesHistory() {
    historyList.innerHTML = '';
    salesHistory.forEach(sale => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">${sale.createdAt.toDate().toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap font-bold">₹${sale.totalAmount.toFixed(2)}</td>
            <td class="px-6 py-4 whitespace-nowrap">${sale.items.length}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                <button class="text-blue-600 hover:underline" onclick="alert('${sale.items.map(i => `${i.name} (x${i.quantity})`).join('\\n')}')">View</button>
            </td>
        `;
        historyList.appendChild(row);
    });
}

function exportToTally(bill, isCurrentBill) {
    if (bill.length === 0) {
        alert("No items to export.");
        return;
    }
    let csvContent = "Date,Voucher Type,Voucher No.,Item Name,Quantity,Rate,Amount\n";
    
    if (isCurrentBill) {
        const today = new Date().toLocaleDateString('en-GB');
        const voucherNo = `SALE-${Date.now()}`;
        bill.forEach(item => {
            const row = [
                today, "Sales", voucherNo, `"${item.name}"`,
                item.quantity, item.price.toFixed(2), (item.price * item.quantity).toFixed(2)
            ].join(',');
            csvContent += row + "\n";
        });
    } else { // Exporting history
        bill.forEach(sale => {
            const saleDate = sale.createdAt.toDate().toLocaleDateString('en-GB');
            const voucherNo = `SALE-${sale.id}`;
            sale.items.forEach(item => {
                const row = [
                    saleDate, "Sales", voucherNo, `"${item.name}"`,
                    item.quantity, item.price.toFixed(2), (item.price * item.g_quantity).toFixed(2)
                ].join(',');
                csvContent += row + "\n";
            });
        });
    }


    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `sales-export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

exportBtn.addEventListener('click', () => exportToTally(currentBill, true));
exportHistoryBtn.addEventListener('click', () => exportToTally(salesHistory, false));
