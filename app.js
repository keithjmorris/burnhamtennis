// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, orderBy } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: "AIzaSyAzg6XcQ0CZnpzAc1uK07rIgDtDYHJbvK8",
  authDomain: "burnhamtennnis.firebaseapp.com",
  projectId: "burnhamtennnis",
  storageBucket: "burnhamtennnis.firebasestorage.app",
  messagingSenderId: "26636389744",
  appId: "1:26636389744:web:c018959c23161596c5d3b5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserData = null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        showApp();
        loadGames();
    } else {
        currentUser = null;
        currentUserData = null;
        showAuth();
    }
});

function showAuth() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
}

function showApp() {
    document.getElementById('authContainer').style.display = 'none';
    document.getElementById('appContainer').style.display = 'block';
    showGames();
}

window.showLogin = () => {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
};

window.showRegister = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
};

window.login = async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
};

window.register = async () => {
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phone = document.getElementById('regPhone').value.trim();
    const password = document.getElementById('regPassword').value;
    
    if (!firstName || !lastName || !email || !phone) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        const approvedQuery = query(collection(db, 'approvedPlayers'), where('email', '==', email.toLowerCase()));
        const approvedSnapshot = await getDocs(approvedQuery);
        
        if (approvedSnapshot.empty) {
            alert('Your email is not on the approved players list. Please contact the club admin.');
            return;
        }
        
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        await addDoc(collection(db, 'users'), {
            uid: userCredential.user.uid,
            firstName,
            lastName,
            email: email.toLowerCase(),
            phone,
            createdAt: serverTimestamp()
        });
        
        alert('Registration successful!');
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
};

window.logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        alert('Logout failed: ' + error.message);
    }
};

async function loadUserData() {
    const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
    const userSnapshot = await getDocs(userQuery);
    
    if (!userSnapshot.empty) {
        currentUserData = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
        
        const adminQuery = query(collection(db, 'admins'), where('email', '==', currentUser.email));
        const adminSnapshot = await getDocs(adminQuery);
        
        if (!adminSnapshot.empty) {
            document.getElementById('navAdmin').style.display = 'flex';
        }
    }
}

window.showGames = () => {
    hideAllViews();
    document.getElementById('gamesView').style.display = 'block';
    setActiveNav('navGames');
    loadGames();
};

window.showMyGames = () => {
    hideAllViews();
    document.getElementById('myGamesView').style.display = 'block';
    setActiveNav('navMyGames');
    loadMyGames();
};

window.showArrange = () => {
    hideAllViews();
    document.getElementById('arrangeView').style.display = 'block';
    setActiveNav('navArrange');
};

window.showAdmin = () => {
    hideAllViews();
    document.getElementById('adminView').style.display = 'block';
    setActiveNav('navAdmin');
    loadApprovedPlayers();
};

function hideAllViews() {
    document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
}

function setActiveNav(activeId) {
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(activeId).classList.add('active');
}

async function loadGames() {
    const gamesQuery = query(collection(db, 'games'), orderBy('date', 'asc'));
    const gamesSnapshot = await getDocs(gamesQuery);
    
    const gamesList = document.getElementById('gamesList');
    gamesList.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    gamesSnapshot.forEach((doc) => {
        const game = { id: doc.id, ...doc.data() };
        const gameDate = new Date(game.date);
        
        if (gameDate >= today) {
            gamesList.appendChild(createGameCard(game, false));
        }
    });
    
    if (gamesList.children.length === 0) {
        gamesList.innerHTML = '<p class="empty-state">No upcoming games</p>';
    }
}

async function loadMyGames() {
    if (!currentUserData) return;
    
    const userName = `${currentUserData.firstName} ${currentUserData.lastName}`;
    const gamesQuery = query(collection(db, 'games'), orderBy('date', 'asc'));
    const gamesSnapshot = await getDocs(gamesQuery);
    
    const myGamesList = document.getElementById('myGamesList');
    myGamesList.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    gamesSnapshot.forEach((doc) => {
        const game = { id: doc.id, ...doc.data() };
        const gameDate = new Date(game.date);
        
        if (gameDate >= today && game.players && game.players.includes(userName)) {
            myGamesList.appendChild(createGameCard(game, true));
        }
    });
    
    if (myGamesList.children.length === 0) {
        myGamesList.innerHTML = '<p class="empty-state">You haven\'t joined any games yet</p>';
    }
}

function createGameCard(game, isMyGames) {
    const card = document.createElement('div');
    card.className = 'game-card';
    
    const userName = currentUserData ? `${currentUserData.firstName} ${currentUserData.lastName}` : '';
    const isJoined = game.players && game.players.includes(userName);
    
    card.innerHTML = `
        <div class="game-header">
            <div class="game-date">${formatDate(game.date)}</div>
            <div class="game-time">${game.time}</div>
        </div>
        <div class="game-players">
            <strong>${game.players ? game.players.length : 0} players:</strong>
            ${game.players ? game.players.join(', ') : 'No players yet'}
        </div>
        <div class="game-actions">
            ${isMyGames 
                ? `<button onclick="leaveGame('${game.id}')" class="btn-danger">Leave Game</button>`
                : isJoined
                    ? '<span class="joined-badge">✓ Joined</span>'
                    : `<button onclick="joinGame('${game.id}')" class="btn-primary">Join Game</button>`
            }
        </div>
    `;
    
    return card;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

window.createGame = async () => {
    const date = document.getElementById('gameDate').value;
    const time = document.getElementById('gameTime').value;
    
    if (!date || !time) {
        alert('Please select date and time');
        return;
    }
    
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        alert('Cannot create games in the past');
        return;
    }
    
    try {
        const userName = `${currentUserData.firstName} ${currentUserData.lastName}`;
        
        await addDoc(collection(db, 'games'), {
            date,
            time,
            players: [userName],
            createdBy: currentUser.uid,
            createdAt: serverTimestamp()
        });
        
        document.getElementById('gameDate').value = '';
        document.getElementById('gameTime').value = '';
        
        alert('Game created successfully!');
        showGames();
    } catch (error) {
        alert('Failed to create game: ' + error.message);
    }
};

window.joinGame = async (gameId) => {
    try {
        const userName = `${currentUserData.firstName} ${currentUserData.lastName}`;
        const gameRef = doc(db, 'games', gameId);
        
        await updateDoc(gameRef, {
            players: arrayUnion(userName)
        });
        
        loadGames();
    } catch (error) {
        alert('Failed to join game: ' + error.message);
    }
};

window.leaveGame = async (gameId) => {
    if (!confirm('Are you sure you want to leave this game?')) return;
    
    try {
        const userName = `${currentUserData.firstName} ${currentUserData.lastName}`;
        const gameRef = doc(db, 'games', gameId);
        
        await updateDoc(gameRef, {
            players: arrayRemove(userName)
        });
        
        loadMyGames();
    } catch (error) {
        alert('Failed to leave game: ' + error.message);
    }
};

window.showAddPlayer = () => {
    document.getElementById('addPlayerForm').style.display = 'block';
};

window.hideAddPlayer = () => {
    document.getElementById('addPlayerForm').style.display = 'none';
    document.getElementById('adminFirstName').value = '';
    document.getElementById('adminLastName').value = '';
    document.getElementById('adminEmail').value = '';
};

async function loadApprovedPlayers() {
    const playersQuery = query(collection(db, 'approvedPlayers'), orderBy('lastName', 'asc'));
    const playersSnapshot = await getDocs(playersQuery);
    
    const playersList = document.getElementById('approvedPlayersList');
    playersList.innerHTML = '';
    
    playersSnapshot.forEach((doc) => {
        const player = { id: doc.id, ...doc.data() };
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player-item';
        playerDiv.innerHTML = `
            <div>
                <strong>${player.firstName} ${player.lastName}</strong><br>
                <small>${player.email}</small>
            </div>
            <button onclick="removePlayer('${doc.id}')" class="btn-danger-small">Remove</button>
        `;
        playersList.appendChild(playerDiv);
    });
}

window.addApprovedPlayer = async () => {
    const firstName = document.getElementById('adminFirstName').value.trim();
    const lastName = document.getElementById('adminLastName').value.trim();
    const email = document.getElementById('adminEmail').value.trim().toLowerCase();
    
    if (!firstName || !lastName || !email) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        await addDoc(collection(db, 'approvedPlayers'), {
            firstName,
            lastName,
            email,
            addedAt: serverTimestamp()
        });
        
        hideAddPlayer();
        loadApprovedPlayers();
        alert('Player added successfully!');
    } catch (error) {
        alert('Failed to add player: ' + error.message);
    }
};

window.removePlayer = async (playerId) => {
    if (!confirm('Remove this player from approved list?')) return;
    
    try {
        await deleteDoc(doc(db, 'approvedPlayers', playerId));
        loadApprovedPlayers();
    } catch (error) {
        alert('Failed to remove player: ' + error.message);
    }
};