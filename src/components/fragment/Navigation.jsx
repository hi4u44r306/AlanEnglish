import React, {useContext, useState} from "react";
import '../assets/scss/Navigation.scss';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import DropDownClassList from "./DropDownClassList";
import SearchBar from "./SearchBar";
import Brand from "./Brand";
import DropDownProfile from "./DropDownProfile";
import {Avatar, Button} from "@material-ui/core";
import {ThemeContext} from "../../api/Theme";
import Logout from "./Logout";

function Navigation() {

    const [isLanguageListOpen, setLangList] = useState(false);
    const [isOpenProfile, setOpenProfile] = useState(false);


    function handleOpenLanguageList() {
        if (isOpenProfile === true)
            setOpenProfile(!isOpenProfile);
        setLangList(!isLanguageListOpen);
    }

    function handleOpenProfile() {
        if (isLanguageListOpen === true)
            setLangList(!isLanguageListOpen);
        setOpenProfile(!isOpenProfile);
    }
    const useStyle = useContext(ThemeContext);
    return (
        <nav style={useStyle.component}>
            <Brand/>
            <div className={"navigation"}>
               {/* <NavigationButton href={"/home"} name={"Home"}/>*/}
               {/* <NavigationButton href={"/home/about"} name={"About"}/>*/}
                {/*<NavigationButton href={"/home/add"} name={"Add"}/>*/}
            </div>
            <SearchBar/>
            {/* <div className={"language"} onClick={handleOpenLanguageList}>
                <Button className={"Dropdown-btn"}
                        endIcon={isLanguageListOpen ? <ExpandMoreIcon/> : <ExpandLessIcon/>}>
                    <div className="wrapper">
                        <p>習作本分類</p>
                    </div>
                </Button>
                {
                    isLanguageListOpen
                    &&
                    <DropDownClassList/>
                }
            </div> */}
            <div className="profile" onClick={handleOpenProfile}>
                <Logout/>
            </div>
        </nav>
    );
}

export default Navigation;