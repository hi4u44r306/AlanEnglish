import React from "react";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.scss";
import "./MobileNavFix.scss";
import "../components/assets/scss/BrowserCompatibility.scss";
import Login from "../components/Pages/Login";
import Signup from "../components/Pages/Signup";
import Showcase from "../components/Pages/Showcase";
import Links from "../components/Pages/Links";
import LinkAdmin from "../components/Pages/LinkAdmin";
import Playlist from "../components/fragment/Playlist";
import Containerfull from "../components/fragment/Containerfull";
import User from "../components/Pages/User";
import AddMusic from "../components/Pages/AddMusicV3";
import NotFound from "../components/Pages/NotFound";
import ManagementDashboard from "../components/Pages/ManagementDashboard";
import AccountManagement from "../components/Pages/AccountManagement";
import AcademyStudentCsvImport from "../components/Pages/AcademyStudentCsvImport";
import AIMaterialGenerator from "../components/Pages/AIMaterialGenerator";
import ConversationPractice from "../components/Pages/ConversationPractice";
import TeacherAssignments from "../components/Pages/TeacherAssignments";
import StudentAssignments from "../components/Pages/StudentAssignments";
import ReviewCenter from "../components/Pages/ReviewCenter";
import WeeklyReport from "../components/Pages/WeeklyReport";
import FreeTrialSignup from "../components/Pages/FreeTrialSignup";
import MembershipCenter from "../components/Pages/MembershipCenter";
import BillingResult from "../components/Pages/BillingResult";
import LearningLevel from "../components/Pages/LearningLevel";
import LearningLeaderboard from "../components/Pages/LearningLeaderboard";
import Rewards from "../components/Pages/Rewards";
import RewardsAdmin from "../components/Pages/RewardsAdmin";
import ApiUsageAdmin from "../components/Pages/ApiUsageAdmin";
import MembershipAdmin from "../components/Pages/MembershipAdmin";
import LevelAdmin from "../components/Pages/LevelAdmin";
import CatalogAdmin from "../components/Pages/CatalogAdmin";
import LegacyCleanupAdmin from "../components/Pages/LegacyCleanupAdmin";
import AcademyInviteSignup from "../components/Pages/AcademyInviteSignup";
import ForgotPassword from "../components/Pages/ForgotPassword";
import AcademyStudentSetup from "../components/Pages/AcademyStudentSetup";
import AccountSecurity from "../components/Pages/AccountSecurity";
import StudentSettings from "../components/Pages/StudentSettings";
import StudentNotifications from "../components/Pages/StudentNotifications";
import MaterialCatalog from "../components/Pages/MaterialCatalog";
import StoreCatalog from "../components/Pages/StoreCatalog";
import StoreAuthPage from "../components/Pages/StoreAuthPage";
import StoreVerificationPage from "../components/Pages/StoreVerificationPage";
import StoreCart from "../components/Pages/StoreCart";
import StoreCheckout from "../components/Pages/StoreCheckout";
import StoreOrders from "../components/Pages/StoreOrders";
import StorePaymentResult from "../components/Pages/StorePaymentResult";
import StorePasswordPage from "../components/Pages/StorePasswordPage";
import AdminStoreOrders from "../components/Pages/AdminStoreOrders";
import AdminClassMaterials from "../components/Pages/AdminClassMaterials";
import AdminMaterialPackages from "../components/Pages/AdminMaterialPackages";
import AdminStudentLifecycle from "../components/Pages/AdminStudentLifecycle";
import Support from "../components/Pages/Support";
import AdminSupport from "../components/Pages/AdminSupport";
import { AuthProvider } from "../auth/AuthContext";
import ProtectedRoute from "../auth/ProtectedRoute";
import RoleHomeRedirect from "../auth/RoleHomeRedirect";
import { StoreProvider } from "../store/StoreContext";
import publicSeo from "../config/publicSeo.json";

const LegacyPlaylistRedirect = () => {
    const { playlistId } = useParams();
    return <Navigate to={`/student/books/${playlistId}`} replace />;
};

const RouteSeoPolicy = () => {
    const { pathname } = useLocation();
    const normalizedPath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    const isIndexable = Boolean(publicSeo[normalizedPath]);
    const policy = isIndexable ? "index,follow" : "noindex,nofollow";

    return (
        <Helmet>
            <meta name="robots" content={policy} />
            <meta name="googlebot" content={policy} />
        </Helmet>
    );
};

const App = () => {
    return (
        <Router>
            <AuthProvider>
                <StoreProvider>
                <ToastContainer
                    position="top-center"
                    autoClose={2000}
                    limit={2}
                    hideProgressBar={false}
                    newestOnTop
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss={false}
                    draggable
                    pauseOnHover={false}
                />

                <Helmet>
                    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
                    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
                    <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
                    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
                    <meta name="theme-color" content="#073763" />
                </Helmet>

                <RouteSeoPolicy />

                <Routes>
                    <Route path="/" element={<Showcase />} />
                    <Route path="/links" element={<Links />} />
                    <Route path="/home" element={<Navigate to="/" replace />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/solve" element={<Navigate to="/forgot-password" replace />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/academy/invite" element={<AcademyInviteSignup />} />
                    <Route path="/academy/activate" element={<AcademyInviteSignup manualEntry />} />
                    <Route path="/academy/student-setup" element={<AcademyStudentSetup />} />
                    <Route path="/academy/recover" element={<AcademyStudentSetup recoveryOnly />} />
                    <Route path="/support" element={<Support />} />
                    <Route path="/showcase" element={<Navigate to="/" replace />} />
                    <Route path="/freetrial" element={<FreeTrialSignup />} />
                    <Route path="/materials" element={<MaterialCatalog />} />
                    <Route path="/shop" element={<StoreCatalog />} />
                    <Route path="/shop/cart" element={<StoreCart />} />
                    <Route path="/shop/login" element={<StoreAuthPage />} />
                    <Route path="/shop/register" element={<StoreAuthPage register />} />
                    <Route path="/shop/verified" element={<StoreVerificationPage />} />
                    <Route path="/shop/forgot-password" element={<StorePasswordPage />} />
                    <Route path="/shop/reset-password" element={<StorePasswordPage update />} />
                    <Route path="/shop/checkout" element={<StoreCheckout />} />
                    <Route path="/shop/orders" element={<StoreOrders />} />
                    <Route path="/shop/orders/:orderNumber" element={<StoreOrders />} />
                    <Route path="/shop/payment/success" element={<StorePaymentResult />} />

                    <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><User /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/assignments" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><StudentAssignments /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/review" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><ReviewCenter /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/weekly-report" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><WeeklyReport /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/membership" element={<ProtectedRoute allowedRoles={["student"]}><Containerfull><MembershipCenter /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/settings" element={<ProtectedRoute allowedRoles={["student"]}><Containerfull><StudentSettings /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/notifications" element={<ProtectedRoute allowedRoles={["student"]}><Containerfull><StudentNotifications /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/level" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><LearningLevel /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/leaderboard" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><LearningLeaderboard /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/rewards" element={<ProtectedRoute allowedRoles={["student"]} requiresActiveMembership><Containerfull><Rewards /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/conversation" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin"]} requiresActiveMembership><Containerfull><ConversationPractice /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/ai-generator" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin"]} requiresActiveMembership><Containerfull><AIMaterialGenerator /></Containerfull></ProtectedRoute>} />
                    <Route path="/student/books/:playlistId" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin"]} requiresActiveMembership><Containerfull><Playlist /></Containerfull></ProtectedRoute>} />
                    <Route path="/billing/success" element={<ProtectedRoute allowedRoles={["student"]}><Containerfull><BillingResult /></Containerfull></ProtectedRoute>} />
                    <Route path="/billing/cancel" element={<ProtectedRoute allowedRoles={["student"]}><Containerfull><BillingResult cancelled /></Containerfull></ProtectedRoute>} />
                    <Route path="/account/security" element={<ProtectedRoute allowedRoles={["student", "teacher", "admin"]}><Containerfull><AccountSecurity /></Containerfull></ProtectedRoute>} />

                    <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><ManagementDashboard /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/reports" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><WeeklyReport /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/assignments" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><TeacherAssignments /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/accounts" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><AccountManagement /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/accounts/create" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><Signup /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/music/create" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><AddMusic /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/music/manage" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><AddMusic /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/leaderboard" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><LearningLeaderboard /></Containerfull></ProtectedRoute>} />
                    <Route path="/teacher/class-materials" element={<ProtectedRoute allowedRoles={["teacher", "admin"]}><Containerfull><AdminClassMaterials /></Containerfull></ProtectedRoute>} />

                    <Route path="/admin/dashboard" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><ManagementDashboard /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/reports" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><WeeklyReport /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/accounts" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AccountManagement /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/accounts/import" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AcademyStudentCsvImport /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/leaderboard" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><LearningLeaderboard /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/rewards" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><RewardsAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/navbar" element={<Navigate to="/admin/catalog" replace />} />
                    <Route path="/admin/links" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><LinkAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/membership" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><MembershipAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/api-usage" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><ApiUsageAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/levels" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><LevelAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/catalog" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><CatalogAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/legacy-cleanup" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><LegacyCleanupAdmin /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/support" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AdminSupport /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/class-materials" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AdminClassMaterials /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/material-packages" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AdminMaterialPackages /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/store-orders" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AdminStoreOrders /></Containerfull></ProtectedRoute>} />
                    <Route path="/admin/student-lifecycle" element={<ProtectedRoute allowedRoles={["admin"]}><Containerfull><AdminStudentLifecycle /></Containerfull></ProtectedRoute>} />

                    <Route path="/userinfo" element={<RoleHomeRedirect />} />
                    <Route path="/teacher/add-music" element={<Navigate to="/teacher/music/create" replace />} />
                    <Route path="/teacher/students" element={<Navigate to="/teacher/accounts/create" replace />} />
                    <Route path="/home/playlist/addmusic" element={<Navigate to="/teacher/music/create" replace />} />
                    <Route path="/home/playlist/signup" element={<Navigate to="/teacher/accounts/create" replace />} />
                    <Route path="/home/playlist/:playlistId" element={<LegacyPlaylistRedirect />} />
                    <Route path="/teacher/navbar" element={<Navigate to="/admin/navbar" replace />} />
                    <Route path="/editnavbar" element={<Navigate to="/admin/navbar" replace />} />
                    <Route path="/signup" element={<Navigate to="/teacher/accounts/create" replace />} />
                    <Route path="/linksadmin" element={<Navigate to="/admin/links" replace />} />

                    <Route path="*" element={<NotFound />} />
                </Routes>
                </StoreProvider>
            </AuthProvider>
        </Router>
    );
};

export default App;
