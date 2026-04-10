import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import * as corsLib from "cors";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();
const db = admin.firestore();
const cors = corsLib({ origin: true });

// Define Secrets (Modern Cloud Secret Manager API)
const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

/**
 * Creates a Stripe Checkout Session
 * Expected data: { priceId: string, plan: 'VIP'|'Premium', days: 30|60, successUrl: string, cancelUrl: string }
 */
export const createCheckoutSession = functions
    .runWith({ secrets: ["STRIPE_SECRET_KEY"] })
    .https.onCall(async (data, context) => {

        const stripe = new Stripe(STRIPE_SECRET_KEY.value(), {
            apiVersion: "2026-03-25.dahlia" as any,
        });

        if (!context.auth) {
            throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
        }

        const { priceId, plan, days, successUrl, cancelUrl } = data;
        const uid = context.auth.uid;

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: "payment",
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    uid: uid,
                    plan: plan,
                    days: days.toString(),
                },
            });

            return { url: session.url };
        } catch (error: any) {
            console.error("Stripe Error:", error);
            throw new functions.https.HttpsError("internal", error.message);
        }
    });

/**
 * Webhook that handles successful payments from Stripe
 */
export const stripeWebhook = functions
    .runWith({ secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] })
    .https.onRequest((req, res) => {

        const stripe = new Stripe(STRIPE_SECRET_KEY.value(), {
            apiVersion: "2026-03-25.dahlia" as any,
        });

        cors(req, res, async () => {
            const sig = req.headers["stripe-signature"];

            let event: Stripe.Event;

            try {
                event = stripe.webhooks.constructEvent(req.rawBody, sig as string, STRIPE_WEBHOOK_SECRET.value());
            } catch (err: any) {
                console.error("Webhook Error:", err.message);
                res.status(400).send(`Webhook Error: ${err.message}`);
                return;
            }

            if (event.type === "checkout.session.completed") {
                const session = event.data.object as Stripe.Checkout.Session;
                const metadata = session.metadata;

                if (metadata) {
                    const uid = metadata.uid;
                    const plan = metadata.plan as "VIP" | "Premium";
                    const days = parseInt(metadata.days);

                    await updateAdvisorSubscription(uid, plan, days);
                }
            }

            res.json({ received: true });
        });
    });

async function updateAdvisorSubscription(uid: string, plan: "VIP" | "Premium", days: number) {
    const userRef = db.collection("advisors").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        console.error(`Advisor ${uid} not found`);
        return;
    }

    const profile = doc.data();
    if (!profile) return;

    const now = Date.now();
    const addedMs = days * 24 * 60 * 60 * 1000;

    let newVigenciaVIP = profile.vigenciaVIP || 0;
    let newVigenciaPremium = profile.vigenciaPremium || 0;

    if (plan === "Premium") {
        // Si ya hay premium, se suma al premium actual. Si no, empieza desde ahora.
        const baseDate = newVigenciaPremium > now ? newVigenciaPremium : now;
        newVigenciaPremium = baseDate + addedMs;

        // Si se compra Premium teniendo VIP, el VIP se pausa (o los ms restantes se añaden AL FINAL del Premium)
        const vipTimeLeft = newVigenciaVIP > now ? newVigenciaVIP - now : 0;
        if (vipTimeLeft > 0) {
            newVigenciaVIP = newVigenciaPremium + vipTimeLeft;
        }
    } else if (plan === "VIP") {
        // Si compra VIP teniendo Premium... el VIP debe ir hasta el final del Premium
        if (newVigenciaPremium > now) {
            const baseVIP = newVigenciaVIP > newVigenciaPremium ? newVigenciaVIP : newVigenciaPremium;
            newVigenciaVIP = baseVIP + addedMs;
        } else {
            // No hay premium actual
            const baseDate = newVigenciaVIP > now ? newVigenciaVIP : now;
            newVigenciaVIP = baseDate + addedMs;
        }
    }

    await userRef.update({
        vigenciaVIP: newVigenciaVIP,
        vigenciaPremium: newVigenciaPremium,
        lastPaymentAt: admin.firestore.FieldValue.serverTimestamp(),
        lastPaymentPlan: plan,
        lastPaymentDays: days
    });

    console.log(`Updated subscription for ${uid}: VIP=${newVigenciaVIP}, Premium=${newVigenciaPremium}`);
}
