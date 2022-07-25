import React from "react";
import SearchBar from "./SearchBar";
import '../assets/scss/MobTopNav.scss';
import Brand from "./Brand";
import Logout from "./Logout";

class MobileTopNavigation extends React.Component{
    render() {
        return(
            <nav className="mob-top-navigation">
                <Brand/>
                <SearchBar/>
                <Logout/>
            </nav>
        );
    }
}

export default MobileTopNavigation;