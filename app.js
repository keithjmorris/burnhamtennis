// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, addDoc, setDoc, getDoc, getDocs, doc, query, where, deleteDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';

const firebaseConfig = {
  apiKey: "AIzaSyBPDxnd2nGvxHC5Aig3ZeeFlpmOzP6E9Nk",
  authDomain: "tenniscompetitionapp.firebaseapp.com",
  projectId: "tenniscompetitionapp",
  storageBucket: "tenniscompetitionapp.firebasestorage.app",
  messagingSenderId: "924063493946",
  appId: "1:924063493946:web:02fd16ac2c991f72666a03"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let currentUserData = null;   // their 'members' document
let allUsers = {};            // cache of members, keyed by uid
let confirmationResult = null;

const ratingNames = {
    1: 'Beginner', 2: 'Improver', 3: 'Social',
    4: 'Intermediate', 5: 'Improving Club Player', 6: 'Strong Club Player'
};

const VAPID_KEY = 'BJAj3KnB8v8gjYJRRZ6R0_9U9C58a2_9TBKXn8LlbUTJ__OCs_WgA8D-zUdwknXzn3N8j1u-ANRrusLBpDQXXug';

function updateAlertsToggleUI() {
    const btn = document.getElementById('alertsToggleBtn');
    if (!btn) return;
        console.log('updateAlertsToggleUI running, alertsEnabled =', currentUserData?.alertsEnabled);

    btn.textContent = currentUserData?.alertsEnabled ? '🔔 Alerts On' : '🔕 Alerts Off';
}

function setupForegroundMessaging() {
    try {
        const messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
            console.log('Notification received while app open:', payload);
        });
    } catch (error) {
        console.error('Foreground messaging setup failed:', error);
    }
}

window.toggleAlerts = () => {
     console.log('toggleAlerts clicked, currentUserData.alertsEnabled =', currentUserData?.alertsEnabled);
    if (currentUserData?.alertsEnabled) {
        disableAlerts();
    } else {
        enableAlerts();
    }
};

window.enableAlerts = async () => {
    try {
        if (!('serviceWorker' in navigator)) {
            alert('Notifications are not supported on this browser.');
            return;
        }

        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        const permission = await Notification.requestPermission();

        if (permission !== 'granted') {
            alert('Notification permission was not granted.');
            return;
        }

        const messaging = getMessaging(app);
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (!token) {
            alert('Could not get a notification token. Please try again.');
            return;
        }

        await updateDoc(doc(db, 'members', currentUser.uid), { alertsEnabled: true });
        await updateDoc(doc(db, 'memberContacts', currentUser.uid), { fcmToken: token });

        currentUserData.alertsEnabled = true;
        updateAlertsToggleUI();
        setupForegroundMessaging();
        alert('Alerts turned on!');
    } catch (error) {
        alert('Failed to enable alerts: ' + error.message);
    }
};

window.disableAlerts = async () => {
    try {
        await updateDoc(doc(db, 'members', currentUser.uid), { alertsEnabled: false });
        currentUserData.alertsEnabled = false;
        updateAlertsToggleUI();
    } catch (error) {
        alert('Failed to disable alerts: ' + error.message);
    }
};

function formatUKPhone(input) {
    let digits = input.replace(/\D/g, '');
    if (digits.startsWith('0')) digits = digits.slice(1);
    if (digits.startsWith('44')) digits = digits.slice(2);
    return '+44' + digits;
}

window.showPhoneEntry = () => {
    document.getElementById('phoneEntryForm').style.display = 'block';
    document.getElementById('codeEntryForm').style.display = 'none';
    document.getElementById('profileForm').style.display = 'none';
};
window.sendVerificationCode = async () => {
    const rawPhone = document.getElementById('phoneNumber').value.trim();
    if (!rawPhone) {
        alert('Please enter your mobile number');
        return;
    }
    const phone = formatUKPhone(rawPhone);
    const btn = document.getElementById('sendCodeBtn');
    btn.disabled = true;
    btn.textContent = 'Sending...';

    try {
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
        }
        window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });

        confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier);
        document.getElementById('phoneEntryForm').style.display = 'none';
        document.getElementById('codeEntryForm').style.display = 'block';
    } catch (error) {
        alert('Failed to send code: ' + error.message);
        if (window.recaptchaVerifier) {
            window.recaptchaVerifier.clear();
            window.recaptchaVerifier = null;
        }
    } finally {
        btn.disabled = false;
        btn.textContent = 'Send Code';
    }
};

window.verifyCode = async () => {
    const code = document.getElementById('verificationCode').value.trim();
    if (!code) {
        alert('Please enter the code');
        return;
    }
    const btn = document.getElementById('verifyCodeBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        await confirmationResult.confirm(code);
    } catch (error) {
        alert('Incorrect code, please try again.');
        document.getElementById('verificationCode').value = '';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verify';
    }
};

window.completeProfile = async () => {
    const firstName = document.getElementById('regFirstName').value.trim();
    const lastName = document.getElementById('regLastName').value.trim();
    const rating = parseInt(document.getElementById('regRating').value);
    const interests = {
        games: document.getElementById('interestGames').checked,
        social: document.getElementById('interestSocial').checked,
        tournaments: document.getElementById('interestTournaments').checked
    };

    if (!firstName || !lastName) {
        alert('Please enter your first and last name');
        return;
    }
    if (!interests.games && !interests.social && !interests.tournaments) {
        alert('Please select at least one activity');
        return;
    }

    try {
        await setDoc(doc(db, 'members', currentUser.uid), {
            uid: currentUser.uid,
            firstName,
            lastName,
            rating,
            interests,
            approved: { games: false, social: false, tournaments: false },
            alertsEnabled: false,
            createdAt: serverTimestamp()
        });

        await setDoc(doc(db, 'memberContacts', currentUser.uid), {
            phone: currentUser.phoneNumber
        });

        await loadUserData();
        showPendingOrApp();
        if (currentUserData?.alertsEnabled) {
    setupForegroundMessaging();
}
    } catch (error) {
        alert('Failed to save your details: ' + error.message);
    }
};

indow.logout = async () => {
    try {
        await signOut(auth);
        location.reload();
    } catch (error) {
        alert('Logout failed: ' + error.message);
    }
};

function renderMemberCard(member, phone, prefix) {
    const requestedList = Object.keys(member.interests || {}).filter(k => member.interests[k]);
    const requested = requestedList.map(k => k.charAt(0).toUpperCase() + k.slice(1)).join(', ') || 'None';

    const statusBadges = requestedList.map(k => {
        const isApproved = member.approved?.[k];
        return `<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.8em;margin-right:4px;background:${isApproved ? '#c8e6c9' : '#ffe0b2'};color:${isApproved ? '#2e7d32' : '#e65100'};">${k.charAt(0).toUpperCase() + k.slice(1)}: ${isApproved ? 'Approved' : 'Pending'}</span>`;
    }).join('');

    const anyApproved = requestedList.some(k => member.approved?.[k]);

    return `
        <div class="pending-item">
            <div class="pending-name">${member.firstName} ${member.lastName}</div>
            <div class="pending-details">
                Phone: ${phone}<br>
                Rating: ${ratingNames[member.rating] || member.rating}<br>
                Requested: ${requested}<br>
                ${statusBadges}
            </div>

            <div id="editFields-${prefix}-${member.id}" style="display:none; margin-top:10px;">
                <input type="text" id="editFirstName-${prefix}-${member.id}" value="${member.firstName}" placeholder="First Name">
                <input type="text" id="editLastName-${prefix}-${member.id}" value="${member.lastName}" placeholder="Last Name">
                <select id="editRating-${prefix}-${member.id}">
                    ${Object.entries(ratingNames).map(([num, name]) =>
                        `<option value="${num}" ${member.rating == num ? 'selected' : ''}>${num} - ${name}</option>`
                    ).join('')}
                </select>
                <div class="checkbox-row">
                    <input type="checkbox" id="editGames-${prefix}-${member.id}" ${member.interests?.games ? 'checked' : ''}>
                    <label for="editGames-${prefix}-${member.id}">Arrange/join games</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="editSocial-${prefix}-${member.id}" ${member.interests?.social ? 'checked' : ''}>
                    <label for="editSocial-${prefix}-${member.id}">Sunday social session</label>
                </div>
                <div class="checkbox-row">
                    <input type="checkbox" id="editTournaments-${prefix}-${member.id}" ${member.interests?.tournaments ? 'checked' : ''}>
                    <label for="editTournaments-${prefix}-${member.id}">Tournaments/competitions</label>
                </div>
            <button onclick="saveMemberEdits('${member.id}', '${prefix}')" class="btn-secondary">Save Changes</button>
            ${anyApproved ? `<button onclick="revokeMember('${member.id}')" class="btn-danger">Revoke</button>` : ''}
        </div>

            <button onclick="toggleEditMember('${member.id}', '${prefix}')" class="btn-secondary" style="margin-top:8px;">Edit</button>
           ${!anyApproved ? `<button onclick="approveMember('${member.id}')" class="btn-approve" style="margin-top:8px;">Approve</button>` : ''}
        </div>
    `;
}

window.toggleEditMember = (memberId, prefix) => {
    const fields = document.getElementById(`editFields-${prefix}-${memberId}`);
    fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
};

window.saveMemberEdits = async (memberId, prefix) => {
    try {
        const firstName = document.getElementById(`editFirstName-${prefix}-${memberId}`).value.trim();
        const lastName = document.getElementById(`editLastName-${prefix}-${memberId}`).value.trim();
        const rating = parseInt(document.getElementById(`editRating-${prefix}-${memberId}`).value);
        const interests = {
            games: document.getElementById(`editGames-${prefix}-${memberId}`).checked,
            social: document.getElementById(`editSocial-${prefix}-${memberId}`).checked,
            tournaments: document.getElementById(`editTournaments-${prefix}-${memberId}`).checked
        };

        await updateDoc(doc(db, 'members', memberId), { firstName, lastName, rating, interests });

        alert('Changes saved');
        loadPendingApprovals();
        loadAllMembers();
    } catch (error) {
        alert('Failed to save changes: ' + error.message);
    }
};

window.loadPendingApprovals = async () => {
    try {
        const membersSnapshot = await getDocs(collection(db, 'members'));
        const pendingList = document.getElementById('pendingApprovalsList');
        if (!pendingList) return;
        pendingList.innerHTML = '';

        const pending = [];
        membersSnapshot.forEach((docSnap) => {
            const member = { id: docSnap.id, ...docSnap.data() };
            if (!member.interests) return;
            const isPending = Object.keys(member.interests).some(key => member.interests[key] && !member.approved?.[key]);
            if (isPending) pending.push(member);
        });

        if (pending.length === 0) {
            pendingList.innerHTML = '<div class="no-messages">No pending approvals</div>';
            return;
        }

        for (const member of pending) {
            let phone = 'Not available';
            try {
                const contactSnap = await getDoc(doc(db, 'memberContacts', member.id));
                if (contactSnap.exists()) phone = contactSnap.data().phone;
            } catch (e) { console.error(e); }
            pendingList.insertAdjacentHTML('beforeend', renderMemberCard(member, phone, 'pending'));
        }
    } catch (error) {
        console.error('Error loading pending approvals:', error);
    }
};

window.loadAllMembers = async () => {
    try {
        const membersSnapshot = await getDocs(collection(db, 'members'));
        const allList = document.getElementById('allMembersList');
        if (!allList) return;
        allList.innerHTML = '';

        const members = [];
        membersSnapshot.forEach((docSnap) => {
            const member = { id: docSnap.id, ...docSnap.data() };
            if (member.interests) members.push(member);
        });
        members.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

        if (members.length === 0) {
            allList.innerHTML = '<div class="no-messages">No members yet</div>';
            return;
        }

        for (const member of members) {
            let phone = 'Not available';
            try {
                const contactSnap = await getDoc(doc(db, 'memberContacts', member.id));
                if (contactSnap.exists()) phone = contactSnap.data().phone;
            } catch (e) { console.error(e); }
            allList.insertAdjacentHTML('beforeend', renderMemberCard(member, phone, 'all'));
        }
    } catch (error) {
        console.error('Error loading all members:', error);
    }
};

window.revokeMember = async (memberId) => {
    if (!confirm("Revoke this member's approval? They'll need to be re-approved before using the app.")) return;
    try {
        await updateDoc(doc(db, 'members', memberId), {
            approved: { games: false, social: false, tournaments: false }
        });
        loadPendingApprovals();
        loadAllMembers();
    } catch (error) {
        alert('Failed to revoke: ' + error.message);
    }
};

window.approveMember = async (memberId) => {
    try {
        const memberRef = doc(db, 'members', memberId);
        const memberSnap = await getDoc(memberRef);
        if (!memberSnap.exists()) { alert('Member not found'); return; }
        const member = memberSnap.data();
        await updateDoc(memberRef, { approved: { ...member.interests } });
        loadPendingApprovals();
        loadAllMembers();   // ADD THIS LINE
    } catch (error) {
        alert('Failed to approve member: ' + error.message);
    }
};

async function cacheAllUsers() {
    try {
        const membersSnapshot = await getDocs(collection(db, 'members'));
        membersSnapshot.forEach((doc) => {
            const data = doc.data();
            allUsers[data.uid] = data;
        });
    } catch (error) {
        console.error('Error caching members:', error);
    }
}

async function loadUserData() {
    try {
        const memberSnap = await getDoc(doc(db, 'members', currentUser.uid));
        currentUserData = memberSnap.exists() ? memberSnap.data() : null;

        if (currentUserData) {
            const adminQuery = query(collection(db, 'admins'), where('phone', '==', currentUser.phoneNumber));
            const adminSnapshot = await getDocs(adminQuery);
            const adminTab = document.getElementById('navAdmin');
            if (adminTab) adminTab.style.display = !adminSnapshot.empty ? 'flex' : 'none';
        }
    } catch (error) {
        console.error('Error loading member data:', error);
    }
}

function showAuth() {
    document.getElementById('authContainer').style.display = 'block';
    document.getElementById('appContainer').style.display = 'none';
    showPhoneEntry();
}

function showPendingOrApp() {
    if (currentUserData?.approved?.games) {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('appContainer').style.display = 'block';
        showGames();
    } else {
        document.getElementById('phoneEntryForm').style.display = 'none';
        document.getElementById('codeEntryForm').style.display = 'none';
        document.getElementById('profileForm').style.display = 'none';
        document.getElementById('pendingApprovalMessage').style.display = 'block';
    }
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        console.log('DEBUG uid:', user.uid, 'memberData:', currentUserData);
        await cacheAllUsers();

        if (!currentUserData) {
            // First time - needs to fill in profile
            document.getElementById('phoneEntryForm').style.display = 'none';
            document.getElementById('codeEntryForm').style.display = 'none';
            document.getElementById('profileForm').style.display = 'block';
        } else {
            showPendingOrApp();
        }
    } else {
        currentUser = null;
        currentUserData = null;
        allUsers = {};
        showAuth();
    }
});

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
    if (window.loadPendingApprovals) window.loadPendingApprovals();
    if (window.loadAllMembers) window.loadAllMembers();
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
    
    const maxPlayers = game.gameType === 'singles' ? 2 : game.gameType === 'doubles' ? 4 : 8;
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
            const playerLevel = userData?.level ? ` <span class="level-badge">${ratingNames[userData.rating]}</span>` : '';
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
            const playerLevel = userData?.level ? ` <span class="level-badge">${ratingNames[userData.rating]}</span>` : '';
            reservesHTML += `<div class="player-item-game">${index + 1}. ${playerName}${playerLevel}</div>`;
        });
        reservesHTML += '</div>';
    }
    
const gameTypeBadge = `<span class="game-type-badge">${
    game.gameType === 'singles' ? 'Singles' : 
    game.gameType === 'doubles' ? 'Doubles' : 
    'Social Session'
}</span>`;
    const recommendedLevel = game.recommendedLevel ? `<div style="font-size: 0.85em; color: #666; margin-top: 4px;">Recommended: ${ratingNames[game.recommendedLevel]}</div>` : '';
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

window.postAnnouncement = async () => {
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

