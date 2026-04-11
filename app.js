// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, orderBy, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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

// Level display names
const levelNames = {
    'beginner': 'Beginner',
    'beginner-intermediate': 'Beginner/Intermediate',
    'intermediate': 'Intermediate',
    'intermediate-advanced': 'Intermediate/Advanced',
    'advanced': 'Advanced',
    'team': 'Team'
};

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
    const level = document.getElementById('regLevel').value;
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
            level,
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
    
    for (const gameDoc of gamesSnapshot.docs) {
        const game = { id: gameDoc.id, ...gameDoc.data() };
        const gameDate = new Date(game.date);
        
        if (gameDate >= today) {
            const card = await createGameCard(game, false);
            gamesList.appendChild(card);
        }
    }
    
    if (gamesList.children.length === 0) {
        gamesList.innerHTML = '<p class="empty-state">No upcoming games</p>';
    }
}

async function loadMyGames() {
    if (!currentUserData) return;
    
    const gamesQuery = query(collection(db, 'games'), orderBy('date', 'asc'));
    const gamesSnapshot = await getDocs(gamesQuery);
    
    const myGamesList = document.getElementById('myGamesList');
    myGamesList.innerHTML = '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (const gameDoc of gamesSnapshot.docs) {
        const game = { id: gameDoc.id, ...gameDoc.data() };
        const gameDate = new Date(game.date);
        
        const allPlayers = [...(game.players || []), ...(game.reserves || [])];
        const userInGame = allPlayers.some(p => p.uid === currentUserData.uid);
        
        if (gameDate >= today && userInGame) {
            const card = await createGameCard(game, true);
            myGamesList.appendChild(card);
        }
    }
    
    if (myGamesList.children.length === 0) {
        myGamesList.innerHTML = '<p class="empty-state">You haven\'t joined any games yet</p>';
    }
}

async function createGameCard(game, isMyGames) {
    const card = document.createElement('div');
    card.className = 'game-card';
    
    const maxPlayers = game.gameType === 'singles' ? 2 : 4;
    const playerCount = game.players ? game.players.length : 0;
    const reserveCount = game.reserves ? game.reserves.length : 0;
    const isFull = playerCount >= maxPlayers;
    
    const userInPlayers = game.players?.some(p => p.uid === currentUserData?.uid);
    const userInReserves = game.reserves?.some(p => p.uid === currentUserData?.uid);
    const userInGame = userInPlayers || userInReserves;
    
    // Get player details for all players
    const playerDetails = await Promise.all((game.players || []).map(p => getUserDetails(p.uid)));
    const reserveDetails = await Promise.all((game.reserves || []).map(p => getUserDetails(p.uid)));
    
    let playersHTML = '';
    if (playerCount > 0) {
        playersHTML = '<div class="player-list">';
        playerDetails.forEach(player => {
            if (player) {
                playersHTML += `
                    <div class="player-item-game">
                        ✓ ${player.firstName} ${player.lastName}
                        <span class="level-badge">${levelNames[player.level] || player.level}</span>
                    </div>
                `;
            }
        });
        playersHTML += '</div>';
    }
    
    let reservesHTML = '';
    if (reserveCount > 0) {
        reservesHTML = '<div class="reserve-section"><div class="reserve-header">Reserve List:</div>';
        reserveDetails.forEach((player, index) => {
            if (player) {
                reservesHTML += `
                    <div class="player-item-game">
                        ${index + 1}. ${player.firstName} ${player.lastName}
                        <span class="level-badge">${levelNames[player.level] || player.level}</span>
                    </div>
                `;
            }
        });
        reservesHTML += '</div>';
    }
    
    const gameTypeBadge = `<span class="game-type-badge">${game.gameType === 'singles' ? 'Singles' : 'Doubles'}</span>`;
    const recommendedLevel = game.recommendedLevel ? `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Recommended: ${levelNames[game.recommendedLevel]}</div>` : '';
    
    card.innerHTML = `
        <div class="game-header">
            <div>
                ${gameTypeBadge}
                <div class="game-date">${formatDate(game.date)}</div>
            </div>
            <div class="game-time">${game.time}</div>
        </div>
        ${recommendedLevel}
        <div class="game-players">
            <strong>Players (${playerCount}/${maxPlayers}):</strong>
            ${playerCount === 0 ? '<p style="color: #999; margin: 8px 0;">No players yet</p>' : playersHTML}
            ${!isFull ? `<div class="spots-remaining">${maxPlayers - playerCount} spot${maxPlayers - playerCount !== 1 ? 's' : ''} remaining</div>` : '<div class="game-full">Game full</div>'}
        </div>
        ${reservesHTML}
        <div class="game-actions">
            ${isMyGames 
                ? `<button onclick="leaveGame('${game.id}')" class="btn-danger">Leave Game</button>`
                : userInPlayers
                    ? '<span class="joined-badge">✓ Joined</span>'
                    : userInReserves
                        ? '<span class="joined-badge">✓ On Reserve List</span>'
                        : `<button onclick="joinGame('${game.id}')" class="btn-primary">${isFull ? 'Join Reserve List' : 'Join Game'}</button>`
            }
        </div>
    `;
    
    return card;
}

async function getUserDetails(uid) {
    const userQuery = query(collection(db, 'users'), where('uid', '==', uid));
    const userSnapshot = await getDocs(userQuery);
    
    if (!userSnapshot.empty) {
        return userSnapshot.docs[0].data();
    }
    return null;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

window.updatePlayerLimit = () => {
    const gameType = document.getElementById('gameType').value;
    // This function is called when game type changes - can add visual feedback if needed
};

window.createGame = async () => {
    const gameType = document.getElementById('gameType').value;
    const date = document.getElementById('gameDate').value;
    const time = document.getElementById('gameTime').value;
    const recommendedLevel = document.getElementById('recommendedLevel').value;
    
    if (!gameType) {
        alert('Please select a game type');
        return;
    }
    
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
        const playerData = {
            uid: currentUserData.uid,
            name: `${currentUserData.firstName} ${currentUserData.lastName}`
        };
        
        await addDoc(collection(db, 'games'), {
            gameType,
            date,
            time,
            recommendedLevel: recommendedLevel || null,
            players: [playerData],
            reserves: [],
            createdBy: currentUser.uid,
            createdAt: serverTimestamp()
        });
        
        document.getElementById('gameType').value = '';
        document.getElementById('gameDate').value = '';
        document.getElementById('gameTime').value = '';
        document.getElementById('recommendedLevel').value = '';
        
        alert('Game created successfully!');
        showGames();
    } catch (error) {
        alert('Failed to create game: ' + error.message);
    }
};

window.joinGame = async (gameId) => {
    try {
        const gameRef = doc(db, 'games', gameId);
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
            alert('Game not found');
            return;
        }
        
        const game = gameSnap.data();
        const maxPlayers = game.gameType === 'singles' ? 2 : 4;
        const currentPlayers = game.players ? game.players.length : 0;
        const isFull = currentPlayers >= maxPlayers;
        
        const playerData = {
            uid: currentUserData.uid,
            name: `${currentUserData.firstName} ${currentUserData.lastName}`
        };
        
        if (isFull) {
            // Add to reserves
            await updateDoc(gameRef, {
                reserves: arrayUnion(playerData)
            });
            alert('Added to reserve list!');
        } else {
            // Add to main players
            await updateDoc(gameRef, {
                players: arrayUnion(playerData)
            });
            alert('Joined game successfully!');
        }
        
        loadGames();
    } catch (error) {
        alert('Failed to join game: ' + error.message);
    }
};

window.leaveGame = async (gameId) => {
    if (!confirm('Are you sure you want to leave this game?')) return;
    
    try {
        const gameRef = doc(db, 'games', gameId);
        const gameSnap = await getDoc(gameRef);
        
        if (!gameSnap.exists()) {
            alert('Game not found');
            return;
        }
        
        const game = gameSnap.data();
        const playerData = {
            uid: currentUserData.uid,
            name: `${currentUserData.firstName} ${currentUserData.lastName}`
        };
        
        // Check if in main players or reserves
        const inPlayers = game.players?.some(p => p.uid === currentUserData.uid);
        const inReserves = game.reserves?.some(p => p.uid === currentUserData.uid);
        
        if (inPlayers) {
            await updateDoc(gameRef, {
                players: arrayRemove(playerData)
            });
            
            // If there are reserves, promote the first one
            if (game.reserves && game.reserves.length > 0) {
                const firstReserve = game.reserves[0];
                await updateDoc(gameRef, {
                    players: arrayUnion(firstReserve),
                    reserves: arrayRemove(firstReserve)
                });
            }
        } else if (inReserves) {
            await updateDoc(gameRef, {
                reserves: arrayRemove(playerData)
            });
        }
        
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