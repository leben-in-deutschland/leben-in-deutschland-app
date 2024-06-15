import firebase from "firebase/app";
import "firebase/auth";
import "firebase/firestore";
import { firebaseConfig } from "../config/firebaseConfig";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";


const app = firebase.initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
export const analytics = getAnalytics(app);
