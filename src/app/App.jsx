import React, { useEffect } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { Helmet } from "react-helmet";
import { off, onValue, ref } from "firebase/database";
import "./App.scss";
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
import { AuthProvider } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";

const App = () => {
    useEffect(() => {
        const musicRef = ref(rtdb, "Music");
        const navItemsRef = ref(rtdb, "WebsiteNavbar/");
        const teachingResourcesRef = ref(rtdb, "TeachingResources/");

        const unsubscribeMusic = onValue(musicRef, (snapshot) => {
            if (snapshot.exists()) {
                localStorage.setItem("ae-playlistData", JSON.stringify(snapshot.val()));
            }
        });

        const unsubscribeNavbar = onValue(navItemsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                localStorage.setItem("ae-navData", JSON.stringify(data));
                localStorage.setItem("ae-NavItems", JSON.stringify(Object.keys(data)));
            }
        });

        const unsubscribeTeachingResources = onValue(teachingResourcesRef, (snapshot) => {
            if (snapshot.exists()) {
                const dataArray = Object.entries(snapshot.val()).map(([date, details]) => ({
                    date,
                    ...details
                }));
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
                    <link rel="icon" type="image/png" href="/favicon.ico" sizes="16x16" />
                </Helmet>

                <Routes>
                    <Route path="/" element={<Login />} />
                    <Route path="/links" element={<Links />} />
                    <Route path="/solve" element={<SolvePage />} />
                    <Route path="/showcase" element={<Showcase />} />

                    <Route
                        path="/userinfo"
                        element={
                            <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                                <Containerfull>
                                    <User />
                                </Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/home/playlist/:playlistId"
                        element={
                            <ProtectedRoute allowedRoles={["student", "teacher", "admin"]}>
                                <Containerfull>
                                    <Playlist />
                                </Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/home/playlist/addmusic"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull>
                                    <AddMusic />
                                </Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/editnavbar"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull>
                                    <EditMainNavbar />
                                </Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/linksadmin"
                        element={
                            <ProtectedRoute allowedRoles={["admin"]}>
                                <LinkAdmin />
                            </ProtectedRoute>
                        }
                    />

                    <Route
                        path="/signup"
                        element={
                            <ProtectedRoute allowedRoles={["teacher", "admin"]}>
                                <Containerfull>
                                    <Signup />
                                </Containerfull>
                            </ProtectedRoute>
                        }
                    />

                    <Route path="*" element={<NotFound />} />
                </Routes>
            </AuthProvider>
        </Router>
    );
};

export default App;