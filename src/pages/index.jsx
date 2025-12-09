import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import NewCase from "./NewCase";

import MyCases from "./MyCases";

import Cashiering from "./Cashiering";

import Settings from "./Settings";

import Products from "./Products";

import Timesheets from "./Timesheets";

import PracticeConsul from "./PracticeConsul";

import RPS from "./RPS";

import DiaryDiagnostic from "./DiaryDiagnostic";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    NewCase: NewCase,
    
    MyCases: MyCases,
    
    Cashiering: Cashiering,
    
    Settings: Settings,
    
    Products: Products,
    
    Timesheets: Timesheets,
    
    PracticeConsul: PracticeConsul,
    
    RPS: RPS,
    
    DiaryDiagnostic: DiaryDiagnostic,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/NewCase" element={<NewCase />} />
                
                <Route path="/MyCases" element={<MyCases />} />
                
                <Route path="/Cashiering" element={<Cashiering />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/Products" element={<Products />} />
                
                <Route path="/Timesheets" element={<Timesheets />} />
                
                <Route path="/PracticeConsul" element={<PracticeConsul />} />
                
                <Route path="/RPS" element={<RPS />} />
                
                <Route path="/DiaryDiagnostic" element={<DiaryDiagnostic />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}