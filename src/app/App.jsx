import React, { useEffect } from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { off, onValue, ref } from "firebase/database";
import "./App.scss";
import "./MobileNavFix.scss";
import "../components/assets/scss/BrowserCompatibility.scss";
import Login from "../components/Pages/Login";
import Signup from "../components/Pages/Signup";
import SolvePage from "../components/Pages/SolvePage";
import Showcase from "../components/Pages/Showcase";
import Playlist from "../components/fragment/Playlist";
import Containerfull from "../components/fragment/Containerfull";
import { rtdb } from "../components/Pages/firebase-config";
import User from "../components/Pages/User";
import AddMusic from "../components/Pages/AddMusic";
import EditMainNavbar from "../components/fragment/EditMainNavbar";
import Links from "../components/Pages/Links";
import LinkAdmin from "../components/Pages/Link Admin Page";
import NotFound from "../components/Pages/NotFound";
import ManagementDashboard from "../components/Pages/ManagementDashboard";
import AccountManagement from "../components/Pages/AccountManagement";
import AIMaterialGenerator from "../components/Pages/AIMaterialGenerator";
import ConversationPractice from "../components/Pages/ConversationPractice";
import { AuthProvider } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";
import RoleHomeRedirect from "../auth/RoleHomeRedirect";

const LegacyPlaylistRedirect = () => {
    const { playlistId } = useParams();
    return <Navigate to={`/student/books/${playlistId}`} replace />;
};

const App = () => {
    useEffect(() => {
        const musicRef = ref(rtdb, "Music");
        const navItemsRef = ref(rtdb, "WebsiteNavbar/");
        const teachingResourcesRef = ref(rtdb, "TeachingResources/");

        const unsubscribeMusic = onValue(musicRef, snapshot => {
            if (snapshot.exists()) {
                localStorage.setItem("ae-playlistData", JSON.stringify(snapshot.val()));
            }
        });

        const unsubscribeNavbar = onValue(navItemsRef, snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                localStorage.setItem("ae-navData", JSON.stringify(data));
                localStorage.setItem("ae-NavItems", JSON.stringify(Object.keys(data)));
            }
        });

        const unsubscribeTeachingResources = onValue(teachingResourcesRef, snapshot => {
            if (snapshot.exists()) {
                const dataArray = Object.entries(snapshot.val()).map(([date, details]) => ({ date, ...details }));
                localStorage.setItem("teachingResourcesData", JSON.stringify(dataArray));
            }
        });

        return () => {
            unsubscribeMusic();
            unsubscribeNavbar();
            unsubscribeTeachingResources();
            off(musicRef);
            off(navItemsRef);
            off(teachingResourcesRef);
        };
    }, []);

    return (
        <Router>
            <AuthProvider>
                <Helmet>
                    <link rel="icon" type="image/svg+xml" href="/favicon.svg?v=ae-20260813-logo-2" />
                    <link rel="shortcut icon" href="/favicon.svg?v=ae-20260813-logo-2" />
                    <meta name="theme-color" content="#fff8ed" />
                </Helmet>

                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/links" element={<Links />} />
                    <Route path="/solve" element={<SolvePage />} />
                    <Route path="/showcase" element={<Showcase />} />

                    <Route
                        path="/student/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={["student"]}>
                                <Containerfull><User /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student/conversation"
                        element={
                            <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                                <Containerfull><ConversationPractice /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student/ai-generator"
                        element={
                            <ProtectedRoute allowedRoles={["student"]}>
                                <Containerfull><AIMaterialGenerator /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/student/books/:playlistId"
                        element={
                            <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                                <Containerfull><Playlist /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teacher/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull><ManagementDashboard /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teacher/accounts"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull><AccountManagement /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teacher/add-music"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull><AddMusic /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/teacher/students"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull><Signup /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/dashboard"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <Containerfull><ManagementDashboard /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/accounts"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <Containerfull><AccountManagement /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/navbar"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <Containerfull><EditMainNavbar /></Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/admin/links"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <LinkAdmin />
                            </ProtectedRoute>
                        }
                    />

                    <Route path="/userinfo" element={<RoleHomeRedirect />} />
                    <Route path="/home/playlist/addmusic" element={<Navigate to="/teacher/add-music" replace />} />
                    <Route path="/home/playlist/signup" element={<Navigate to="/teacher/students" replace />} />
                    <Route path="/home/playlist/:playlistId" element={<LegacyPlaylistRedirect />} />
                    <Route path="/teacher/navbar" element={<Navigate to="/admin/navbar" replace />} />
                    <Route path="/editnavbar" element={<Navigate to="/admin/navbar" replace />} />
                    <Route path="/signup" element={<Navigate to="/teacher/students" replace />} />
                    <Route path="/linksadmin" element={<Navigate to="/admin/links" replace />} />

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
};

export default App;
