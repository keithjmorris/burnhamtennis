const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();

async function sendToUid(uid, title, body) {
    if (!uid) return;
    try {
        const contactSnap = await db.collection("memberContacts").doc(uid).get();
        const token = contactSnap.exists ? contactSnap.data().fcmToken : null;
        if (!token) return;

        await getMessaging().send({
            token,
            data: {
                title: String(title),
                body: String(body)
            }
        });
    } catch (error) {
        console.error(`Failed to send to ${uid}:`, error);
    }
}

async function getAlertableUids(excludeUid) {
    const membersSnap = await db.collection("members")
        .where("interests.games", "==", true)
        .get();

    return membersSnap.docs
        .filter(doc => {
            const data = doc.data();
            return data.approved?.games === true && data.alertsEnabled === true;
        })
        .map(doc => doc.id)
        .filter(uid => uid !== excludeUid);
}

// Trigger 1: New game created -> notify everyone eligible except the organiser
exports.onGameCreated = onDocumentCreated("games/{gameId}", async (event) => {
    const game = event.data.data();
    const uids = await getAlertableUids(game.createdBy);

    const title = "New game arranged";
    const body = `${game.gameType === "singles" ? "Singles" : game.gameType === "doubles" ? "Doubles" : "Social Session"} on ${game.date} at ${game.time}`;

    await Promise.all(uids.map(uid => sendToUid(uid, title, body)));
});

// Trigger 2 & 3: Someone leaves a game (notify remaining players) / someone joins (notify organiser)
exports.onGameUpdated = onDocumentUpdated("games/{gameId}", async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const beforePlayers = (before.players || []).map(p => p.uid);
    const afterPlayers = (after.players || []).map(p => p.uid);

    // Someone left
    const left = beforePlayers.filter(uid => !afterPlayers.includes(uid));
    if (left.length > 0) {
        const remaining = afterPlayers.filter(uid => uid !== after.createdBy || afterPlayers.length > 1);
        const title = "Someone left your game";
        const body = `A player left the game on ${after.date} at ${after.time}`;
        await Promise.all(afterPlayers.map(uid => sendToUid(uid, title, body)));
    }

    // Someone joined
    const joined = afterPlayers.filter(uid => !beforePlayers.includes(uid));
    if (joined.length > 0 && after.createdBy && !joined.includes(after.createdBy)) {
        const title = "New player joined your game";
        const body = `Someone joined your game on ${after.date} at ${after.time}`;
        await sendToUid(after.createdBy, title, body);
    }
});