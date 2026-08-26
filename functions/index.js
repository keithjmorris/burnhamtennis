const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

// debug build 25 Aug 21:55

initializeApp();
const db = getFirestore();

async function sendToUid(uid, title, body) {
    const debugRef = db.collection("debugLog").doc();
    if (!uid) {
        await debugRef.set({ uid: null, result: "skipped - no uid", timestamp: new Date() });
        return;
    }
    try {
        const contactSnap = await db.collection("memberContacts").doc(uid).get();
        const token = contactSnap.exists ? contactSnap.data().fcmToken : null;

        if (!token) {
            await debugRef.set({ uid, result: "no token found", timestamp: new Date() });
            return;
        }

        await getMessaging().send({
    token,
    data: {
        title: String(title),
        body: String(body)
    }
});

        await debugRef.set({ uid, result: "sent successfully", tokenPrefix: token.substring(0, 20), timestamp: new Date() });
    } catch (error) {
        await debugRef.set({ uid, result: "ERROR: " + error.message, timestamp: new Date() });
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
    try {
        const game = event.data.data();
        const uids = await getAlertableUids(game.createdBy);

        await db.collection("debugLog").add({
            stage: "onGameCreated started",
            createdBy: game.createdBy || "MISSING",
            uidsFound: uids,
            timestamp: new Date()
        });

        const title = "New game arranged";
        const body = `${game.gameType === "singles" ? "Singles" : game.gameType === "doubles" ? "Doubles" : "Social Session"} on ${game.date} at ${game.time}`;

        await Promise.all(uids.map(uid => sendToUid(uid, title, body)));
    } catch (error) {
        await db.collection("debugLog").add({
            stage: "onGameCreated CRASHED",
            error: error.message,
            timestamp: new Date()
        });
    }
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