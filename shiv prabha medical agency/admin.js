import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

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

let db, auth, storage;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
} catch (e) {
    console.error("Firebase initialization failed:", e);
    alert("Firebase initialization failed.");
}

// --- Page Routing & Auth Protection ---
onAuthStateChanged(auth, (user) => {
    const onAdminPage = window.location.pathname.endsWith('admin.html');
    const onDashboardPage = window.location.pathname.endsWith('dashboard.html');

    if (user) {
        if (onAdminPage) {
            window.location.href = 'dashboard.html';
        }
        if (onDashboardPage) {
            loadAdminDashboard();
        }
    } else {
        if (!onAdminPage) {
            window.location.href = 'admin.html';
        }
    }
});


// --- Admin Login Page Logic ---
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const loginError = document.getElementById('login-error');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            loginError.textContent = "Failed to login. Please check your email and password.";
            console.error("Login failed:", error);
        }
    });
}

// --- Dashboard Page Logic ---
function loadAdminDashboard() {
    const medicineForm = document.getElementById('medicine-form');
    const inventoryList = document.getElementById('inventory-list');
    const imageInput = document.getElementById('medicine-image');
    const imagePreview = document.getElementById('image-preview');
    const logoutButton = document.getElementById('logout-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const scanBarcodeBtn = document.getElementById('scan-barcode-btn');

    let medicines = [];

    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed:", error);
        }
    });

    imageInput.addEventListener('change', () => {
        const file = imageInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    scanBarcodeBtn.addEventListener('click', () => {
        const barcodeInput = document.getElementById('medicine-barcode');
        barcodeInput.focus();
        barcodeInput.select();
    });

    function resetForm() {
        medicineForm.reset();
        document.getElementById('medicine-id').value = '';
        document.getElementById('form-title').textContent = 'Add New Medicine';
        document.getElementById('submit-btn').textContent = 'Add Item';
        imagePreview.classList.add('hidden');
        cancelBtn.classList.add('hidden');
    }

    cancelBtn.addEventListener('click', resetForm);

    onSnapshot(collection(db, "medicines"), (snapshot) => {
        inventoryList.innerHTML = '';
        medicines = [];
        snapshot.forEach(doc => {
            const med = { id: doc.id, ...doc.data() };
            medicines.push(med);
            const itemEl = document.createElement('div');
            itemEl.className = 'flex items-center justify-between p-3 border rounded-lg';
            itemEl.innerHTML = `
                <div class="flex items-center gap-4">
                    <img src="${med.imageUrl || 'https://placehold.co/60x60'}" class="w-16 h-16 object-cover rounded">
                    <div>
                        <p class="font-bold">${med.name}</p>
                        <p class="text-sm text-gray-600">Stock: ${med.stock}</p>
                        <p class="text-sm text-gray-500">Barcode: ${med.barcode || 'N/A'}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button data-id="${med.id}" class="edit-btn bg-yellow-400 hover:bg-yellow-500 text-white font-bold py-1 px-3 rounded">Edit</button>
                    <button data-id="${med.id}" data-image-url="${med.imageUrl}" class="delete-btn bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded">Delete</button>
                </div>
            `;
            inventoryList.appendChild(itemEl);
        });
    });

    medicineForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const medicineId = document.getElementById('medicine-id').value;
        if (medicineId) {
            await updateMedicine(medicineId);
        } else {
            await addMedicine();
        }
    });

    inventoryList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('delete-btn')) {
            deleteMedicine(target.dataset.id, target.dataset.imageUrl);
        }
        if (target.classList.contains('edit-btn')) {
            const medToEdit = medicines.find(m => m.id === target.dataset.id);
            if (medToEdit) {
                populateFormForEdit(medToEdit);
            }
        }
    });

    function populateFormForEdit(med) {
        document.getElementById('form-title').textContent = 'Edit Medicine';
        document.getElementById('submit-btn').textContent = 'Save Changes';
        document.getElementById('medicine-id').value = med.id;
        document.getElementById('medicine-name').value = med.name;
        document.getElementById('medicine-description').value = med.description || '';
        document.getElementById('medicine-price').value = med.price;
        document.getElementById('medicine-stock').value = med.stock;
        document.getElementById('medicine-expiry').value = med.expiryDate;
        document.getElementById('medicine-barcode').value = med.barcode || '';
        imagePreview.src = med.imageUrl;
        imagePreview.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    async function addMedicine() {
        const name = document.getElementById('medicine-name').value.trim();
        const description = document.getElementById('medicine-description').value.trim();
        const price = parseFloat(document.getElementById('medicine-price').value);
        const stock = parseInt(document.getElementById('medicine-stock').value);
        const expiryDate = document.getElementById('medicine-expiry').value;
        const barcode = document.getElementById('medicine-barcode').value.trim();
        const file = imageInput.files[0];

        if (!name || isNaN(price) || isNaN(stock) || !expiryDate || !file) {
            alert("Please fill all fields and select an image.");
            return;
        }

        try {
            const storageRef = ref(storage, `medicines/${Date.now()}-${file.name}`);
            await uploadBytes(storageRef, file);
            const imageUrl = await getDownloadURL(storageRef);
            await addDoc(collection(db, "medicines"), { name, price, stock, imageUrl, description, expiryDate, barcode });
            alert("Medicine added successfully!");
            resetForm();
        } catch (error) {
            console.error("CRITICAL ERROR during addMedicine:", error);
            if (error.code === 'storage/unauthorized') {
                 alert("Failed to add medicine: Permission denied. Please check your Firebase Storage security rules.");
            } else {
                 alert("Failed to add medicine. Check the console for a detailed error message.");
            }
        }
    }

    async function updateMedicine(id) {
        const name = document.getElementById('medicine-name').value.trim();
        const description = document.getElementById('medicine-description').value.trim();
        const price = parseFloat(document.getElementById('medicine-price').value);
        const stock = parseInt(document.getElementById('medicine-stock').value);
        const expiryDate = document.getElementById('medicine-expiry').value;
        const barcode = document.getElementById('medicine-barcode').value.trim();
        const file = imageInput.files[0];

        if (!name || isNaN(price) || isNaN(stock) || !expiryDate) {
            alert("Please fill all fields.");
            return;
        }

        const docRef = doc(db, "medicines", id);
        let imageUrl = medicines.find(m => m.id === id).imageUrl;

        try {
            if (file) {
                const storageRef = ref(storage, `medicines/${Date.now()}-${file.name}`);
                await uploadBytes(storageRef, file);
                imageUrl = await getDownloadURL(storageRef);
            }
            await updateDoc(docRef, { name, description, price, stock, expiryDate, barcode, imageUrl });
            alert("Medicine updated successfully!");
            resetForm();
        } catch (error) {
            console.error("Error updating medicine: ", error);
            alert("Failed to update medicine.");
        }
    }

    async function deleteMedicine(id, imageUrl) {
        if (!confirm("Are you sure you want to delete this item? This cannot be undone.")) {
            return;
        }

        try {
            await deleteDoc(doc(db, "medicines", id));
            if (imageUrl) {
                const imageRef = ref(storage, imageUrl);
                await deleteObject(imageRef);
            }
            alert("Item deleted successfully.");
        } catch (error) {
            console.error("Error deleting item: ", error);
            alert("Failed to delete item. Please check your security rules and permissions.");
        }
    }
}
