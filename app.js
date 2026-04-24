// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, query, where, deleteDoc, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

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
let allUsers = {};

const levelNames = {
    'beginner': 'Beginner',
    'beginner-intermediate': 'Improver',
    'intermediate': 'Intermediate',
    'intermediate-advanced': 'Intermediate/Advanced',
    'advanced': 'Advanced',
    'team': 'Team'
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        await cacheAllUsers();
        showApp();
        loadGames();
    } else {
        currentUser = null;
        currentUserData = null;
        allUsers = {};
        showAuth();
    }
});

async function cacheAllUsers() {
    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        usersSnapshot.forEach((doc) => {
            const userData = doc.data();
            allUsers[userData.uid] = userData;
        });
        console.log('Cached', Object.keys(allUsers).length, 'users');
    } catch (error) {
        console.error('Error caching users:', error);
    }
}

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

window.showForgotPassword = () => {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'block';
};

window.resetPassword = async () => {
    const email = document.getElementById('resetEmail').value.trim();
    
    if (!email) {
        alert('Please enter your email address');
        return;
    }
    
    try {
        await sendPasswordResetEmail(auth, email);
        
        alert('Password reset email sent! Check your inbox (and spam folder).');
        document.getElementById('resetEmail').value = '';
        showLogin();
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            alert('No account found with this email address');
        } else {
            alert('Failed to send reset email: ' + error.message);
        }
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
    try {
        const userQuery = query(collection(db, 'users'), where('uid', '==', currentUser.uid));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            currentUserData = { id: userSnapshot.docs[0].id, ...userSnapshot.docs[0].data() };
            
            const adminQuery = query(collection(db, 'admins'), where('email', '==', currentUser.email));
            const adminSnapshot = await getDocs(adminQuery);
            
            if (!adminSnapshot.empty) {
                const adminTab = document.getElementById('navAdmin');
                if (adminTab) adminTab.style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

window.showGames = () => {
    hideAllViews();
    document.getElementById('gamesView').style.display = 'block';
    setActiveNav('navGames');
    loadGames();
    if (window.loadMessages) window.loadMessages();
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
    if (window.loadAdminMessages) window.loadAdminMessages();
};

function hideAllViews() {
    document.querySelectorAll('.view').forEach(view => view.style.display = 'none');
}

function setActiveNav(activeId) {
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('active');
}

async function loadGames() {
    try {
        const gamesSnapshot = await getDocs(collection(db, 'games'));
        
        const gamesList = document.getElementById('gamesList');
        if (!gamesList) return;
        
        gamesList.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const futureGames = [];
        
        gamesSnapshot.forEach((gameDoc) => {
            const game = { id: gameDoc.id, ...gameDoc.data() };
            if (!game.date) return;
            
            const gameDate = new Date(game.date);
            if (gameDate >= today) {
                futureGames.push(game);
            }
        });
        
        futureGames.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        for (const game of futureGames) {
            const card = await createGameCard(game, false);
            gamesList.appendChild(card);
        }
        
        if (gamesList.children.length === 0) {
            gamesList.innerHTML = '<p class="empty-state">No upcoming games</p>';
        }
    } catch (error) {
        console.error('Error loading games:', error);
    }
}

async function loadMyGames() {
    if (!currentUserData) return;
    
    try {
        const gamesSnapshot = await getDocs(collection(db, 'games'));
        
        const myGamesList = document.getElementById('myGamesList');
        if (!myGamesList) return;
        
        myGamesList.innerHTML = '';
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const myFutureGames = [];
        
        gamesSnapshot.forEach((gameDoc) => {
            const game = { id: gameDoc.id, ...gameDoc.data() };
            if (!game.date) return;
            
            const gameDate = new Date(game.date);
            
            const allPlayers = [...(game.players || []), ...(game.reserves || [])];
            const userInGame = allPlayers.some(p => p.uid === currentUserData.uid);
            
            if (gameDate >= today && userInGame) {
                myFutureGames.push(game);
            }
        });
        
        myFutureGames.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        for (const game of myFutureGames) {
            const card = await createGameCard(game, true);
            myGamesList.appendChild(card);
        }
        
        if (myGamesList.children.length === 0) {
            myGamesList.innerHTML = '<p class="empty-state">You haven\'t joined any games yet</p>';
        }
    } catch (error) {
        console.error('Error loading my games:', error);
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
    
    let playersHTML = '';
    if (playerCount > 0) {
        playersHTML = '<div class="player-list">';
        game.players.forEach(player => {
            const userData = allUsers[player.uid];
            const playerName = userData ? `${userData.firstName} ${userData.lastName}` : player.name;
            const playerLevel = userData?.level ? ` <span class="level-badge">${levelNames[userData.level]}</span>` : '';
            playersHTML += `<div class="player-item-game">✓ ${playerName}${playerLevel}</div>`;
        });
        playersHTML += '</div>';
    }
    
    let reservesHTML = '';
    if (reserveCount > 0) {
        reservesHTML = '<div class="reserve-section"><div class="reserve-header">Reserve List:</div>';
        game.reserves.forEach((player, index) => {
            const userData = allUsers[player.uid];
            const playerName = userData ? `${userData.firstName} ${userData.lastName}` : player.name;
            const playerLevel = userData?.level ? ` <span class="level-badge">${levelNames[userData.level]}</span>` : '';
            reservesHTML += `<div class="player-item-game">${index + 1}. ${playerName}${playerLevel}</div>`;
        });
        reservesHTML += '</div>';
    }
    
const gameTypeBadge = `<span class="game-type-badge">${
    game.gameType === 'singles' ? 'Singles' : 
    game.gameType === 'doubles' ? 'Doubles' : 
    'Social Session'
}</span>`;
    const recommendedLevel = game.recommendedLevel ? `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Recommended: ${levelNames[game.recommendedLevel]}</div>` : '';
    const description = game.description ? `<div class="game-description">${game.description}</div>` : '';

    const isOrganizer = game.createdBy === currentUserData?.uid;
const courtBookingButton = isOrganizer ? 
    `<a href="https://clubspark.lta.org.uk/TheBurnhamsTennisClub/Booking/BookByDate#?date=${game.date}&role=guest" 
        target="_blank" 
        class="btn-court-booking">
        📅 Book Court
    </a>` : '';
    
    // Comments section (only in My Games view, only for players/reserves)
let commentsHTML = '';
if (isMyGames && userInGame) {
    commentsHTML = await createCommentsSection(game.id, game.comments || []);
}
    
    card.innerHTML = `
        <div class="game-header">
            <div>
                ${gameTypeBadge}
                <div class="game-date">${formatDate(game.date)}</div>
            </div>
            <div class="game-time">${game.time}</div>
        </div>
        ${recommendedLevel}
        ${description}
        ${courtBookingButton}
        
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
        ${commentsHTML}
    `;
    
    return card;
}

async function createCommentsSection(gameId, comments) {
    let commentsHTML = '<div class="comments-section">';
    commentsHTML += '<div class="comments-header">Player Comments</div>';
    
    if (comments && comments.length > 0) {
        comments.forEach(comment => {
            const userData = allUsers[comment.uid];
            const authorName = userData ? `${userData.firstName} ${userData.lastName}` : comment.authorName;
            const timeStr = comment.timestamp ? formatCommentTime(comment.timestamp) : 'Just now';
            
            commentsHTML += `
                <div class="comment-item">
                    <div>
                        <span class="comment-author">${authorName}</span>
                        <span class="comment-time">${timeStr}</span>
                    </div>
                    <div class="comment-text">${comment.text}</div>
                </div>
            `;
        });
    } else {
        commentsHTML += '<div class="no-comments">No comments yet</div>';
    }
    
    commentsHTML += `
        <div class="comment-input-section">
            <textarea class="comment-input" id="commentInput-${gameId}" placeholder="Add a comment..." rows="2" maxlength="200"></textarea>
            <button onclick="postComment('${gameId}')" class="btn-comment">Post Comment</button>
        </div>
    `;
    
    commentsHTML += '</div>';
    return commentsHTML;
}

function formatCommentTime(timestamp) {
    if (!timestamp || !timestamp.seconds) return 'Just now';
    
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

window.postComment = async (gameId) => {
    const input = document.getElementById(`commentInput-${gameId}`);
    const text = input.value.trim();
    
    if (!text) {
        alert('Please enter a comment');
        return;
    }
    
    try {
        const gameRef = doc(db, 'games', gameId);
        
        const comment = {
            uid: currentUserData.uid,
            authorName: `${currentUserData.firstName} ${currentUserData.lastName}`,
            text,
            timestamp: serverTimestamp()
        };
        
        await updateDoc(gameRef, {
            comments: arrayUnion(comment)
        });
        
        input.value = '';
        
        // Reload the appropriate view
        const myGamesView = document.getElementById('myGamesView');
        if (myGamesView && myGamesView.style.display !== 'none') {
            loadMyGames();
        } else {
            loadGames();
        }
    } catch (error) {
        alert('Failed to post comment: ' + error.message);
    }
};

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

window.updatePlayerLimit = () => {
    // Called when game type changes
};

window.createGame = async () => {
    const gameType = document.getElementById('gameType').value;
    const date = document.getElementById('gameDate').value;
    const time = document.getElementById('gameTime').value;
    const recommendedLevel = document.getElementById('recommendedLevel').value;
    const description = document.getElementById('gameDescription').value.trim();
    
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
            description: description || null,
            players: [playerData],
            reserves: [],
            comments: [],
            createdBy: currentUser.uid,
            createdAt: serverTimestamp()
        });
        
        // Clear form
        document.getElementById('gameType').value = '';
        document.getElementById('gameDate').value = '';
        document.getElementById('gameTime').value = '';
        document.getElementById('recommendedLevel').value = '';
        document.getElementById('gameDescription').value = '';
        
        // Show booking reminder with link
        showCourtBookingReminder(date, time, gameType);
        
    } catch (error) {
        alert('Failed to create game: ' + error.message);
    }
};

// Court booking reminder
function showCourtBookingReminder(date, time, gameType) {
    const clubSparkUrl = `https://clubspark.lta.org.uk/TheBurnhamsTennisClub/Booking/BookByDate#?date=${date}&role=guest`;
    const courtsNeeded = gameType === 'social' ? 2 : 1;
    const courtText = courtsNeeded === 2 ? '2 courts' : 'a court';
    
    const reminderDiv = document.createElement('div');
    reminderDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        z-index: 1000;
        max-width: 400px;
        text-align: center;
    `;
    
    reminderDiv.innerHTML = `
        <h2 style="margin: 0 0 15px 0; color: #2196f3;">Game Created! 🎾</h2>
        <p style="margin: 0 0 20px 0; color: #555; line-height: 1.5;">
            Don't forget to book <strong>${courtText}</strong> for your game on <strong>${formatDate(date)}</strong> at <strong>${time}</strong>
        </p>
        <a href="${clubSparkUrl}" target="_blank" onclick="closeBookingReminder()"
           style="display: inline-block; background: #4caf50; color: white; 
                  padding: 12px 24px; border-radius: 6px; text-decoration: none; 
                  font-weight: 600; margin-bottom: 10px;">
            Book Court${courtsNeeded === 2 ? 's' : ''} on ClubSpark
        </a>
        <br>
        <button onclick="closeBookingReminder()" 
                style="background: #ddd; color: #333; border: none; 
                       padding: 10px 20px; border-radius: 6px; cursor: pointer; 
                       margin-top: 10px;">
            I'll Book Later
        </button>
    `;
    
    const overlay = document.createElement('div');
    overlay.id = 'bookingOverlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 999;
    `;
    
    document.body.appendChild(overlay);
    document.body.appendChild(reminderDiv);
    
    reminderDiv.id = 'bookingReminder';
}

window.closeBookingReminder = () => {
    const reminder = document.getElementById('bookingReminder');
    const overlay = document.getElementById('bookingOverlay');
    if (reminder) reminder.remove();
    if (overlay) overlay.remove();
    showGames();
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
        const maxPlayers = game.gameType === 'singles' ? 2 : game.gameType === 'doubles' ? 4 : 8;  // FIXED
        const currentPlayers = game.players ? game.players.length : 0;
        const isFull = currentPlayers >= maxPlayers;
        
        const playerData = {
            uid: currentUserData.uid,
            name: `${currentUserData.firstName} ${currentUserData.lastName}`
        };
        
        if (isFull) {
            await updateDoc(gameRef, {
                reserves: arrayUnion(playerData)
            });
            alert('Added to reserve list!');
        } else {
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
        
        const inPlayers = game.players?.some(p => p.uid === currentUserData.uid);
        const inReserves = game.reserves?.some(p => p.uid === currentUserData.uid);
        
        if (inPlayers) {
            await updateDoc(gameRef, {
                players: arrayRemove(playerData)
            });
            
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

// Message Board Functions
window.loadMessages = async () => {
    try {
        const messagesSnapshot = await getDocs(collection(db, 'messages'));
        
        const messagesList = document.getElementById('messagesList');
        if (!messagesList) return;
        
        messagesList.innerHTML = '';
        
        if (messagesSnapshot.empty) {
            messagesList.innerHTML = '<div class="no-messages">No announcements at this time</div>';
            return;
        }
        
        const messages = [];
        messagesSnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        
        messages.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });
        
        messages.forEach((message) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-item';
            
            const date = message.createdAt ? new Date(message.createdAt.seconds * 1000).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            }) : 'Just now';
            
            messageDiv.innerHTML = `
                <div class="message-title">${message.title}</div>
                <div class="message-content">${message.content}</div>
                <div class="message-date">Posted ${date}</div>
            `;
            
            messagesList.appendChild(messageDiv);
        });
    } catch (error) {
        console.error('Error loading messages:', error);
    }
};

window.loadAdminMessages = async () => {
    try {
        const messagesSnapshot = await getDocs(collection(db, 'messages'));
        
        const adminMessagesList = document.getElementById('adminMessagesList');
        if (!adminMessagesList) return;
        
        adminMessagesList.innerHTML = '';
        
        if (messagesSnapshot.empty) {
            adminMessagesList.innerHTML = '<div class="no-messages">No announcements posted</div>';
            return;
        }
        
        const messages = [];
        messagesSnapshot.forEach((doc) => {
            messages.push({ id: doc.id, ...doc.data() });
        });
        
        messages.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });
        
        messages.forEach((message) => {
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message-item';
            
            const date = message.createdAt ? new Date(message.createdAt.seconds * 1000).toLocaleDateString('en-GB', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
            }) : 'Just now';
            
            messageDiv.innerHTML = `
                <div class="message-title">${message.title}</div>
                <div class="message-content">${message.content}</div>
                <div class="message-date">Posted ${date}</div>
                <button onclick="deleteMessage('${message.id}')" class="message-delete">Delete</button>
            `;
            
            adminMessagesList.appendChild(messageDiv);
        });
    } catch (error) {
        console.error('Error loading admin messages:', error);
    }
};

window.postMessage = async () => {
    const title = document.getElementById('messageTitle').value.trim();
    const content = document.getElementById('messageContent').value.trim();
    
    if (!title || !content) {
        alert('Please enter both title and message');
        return;
    }
    
    try {
        await addDoc(collection(db, 'messages'), {
            title,
            content,
            postedBy: currentUser.email,
            createdAt: serverTimestamp()
        });
        
        document.getElementById('messageTitle').value = '';
        document.getElementById('messageContent').value = '';
        
        alert('Announcement posted successfully!');
        window.loadAdminMessages();
    } catch (error) {
        alert('Failed to post announcement: ' + error.message);
    }
};

window.deleteMessage = async (messageId) => {
    if (!confirm('Delete this announcement?')) return;
    
    try {
        await deleteDoc(doc(db, 'messages', messageId));
        window.loadAdminMessages();
    } catch (error) {
        alert('Failed to delete announcement: ' + error.message);
    }
};

// Admin Functions
window.showAddPlayer = () => {
    const addForm = document.getElementById('addPlayerForm');
    if (addForm) addForm.style.display = 'block';
};

window.hideAddPlayer = () => {
    const addForm = document.getElementById('addPlayerForm');
    if (addForm) addForm.style.display = 'none';
    document.getElementById('adminFirstName').value = '';
    document.getElementById('adminLastName').value = '';
    document.getElementById('adminEmail').value = '';
};

async function loadApprovedPlayers() {
    try {
        const playersSnapshot = await getDocs(collection(db, 'approvedPlayers'));
        
        const playersList = document.getElementById('approvedPlayersList');
        if (!playersList) return;
        
        playersList.innerHTML = '';
        
        const players = [];
        playersSnapshot.forEach((doc) => {
            players.push({ id: doc.id, ...doc.data() });
        });
        
        players.sort((a, b) => {
            const lastNameA = (a.lastName || '').toLowerCase();
            const lastNameB = (b.lastName || '').toLowerCase();
            return lastNameA.localeCompare(lastNameB);
        });
        
        players.forEach((player) => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'player-item';
            playerDiv.innerHTML = `
                <div>
                    <strong>${player.firstName} ${player.lastName}</strong><br>
                    <small>${player.email}</small>
                </div>
                <button onclick="removePlayer('${player.id}')" class="btn-danger-small">Remove</button>
            `;
            playersList.appendChild(playerDiv);
        });
    } catch (error) {
        console.error('Error loading approved players:', error);
    }
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
        
        window.hideAddPlayer();
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