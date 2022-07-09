import React, {useContext, useState} from "react";
import '../assets/scss/DropDown.scss';
import Button from "@material-ui/core/Button";
import LangList from "./LangList";
import {ThemeContext} from "../../api/Theme";
import {useDispatch} from "react-redux";
import {setMusicLang} from "../../actions/actions";

const DropDownLanguageList = () => {

    const useStyle = useContext(ThemeContext);

    const listOfLanguage = [
        
        "習作本1",
        "習作本2",
        "習作本3",
        "習作本4",
        "習作本5",
        "習作本6",
    ];
    const [selectedList, setSelectedList] = useState({
        
        "習作本1": false,
        "習作本2": false,
        "習作本3": false,
        "習作本4": false,
        "習作本5": false,
        "習作本6": false,
    });
    const handleSelected = (val, selected) => {
        setSelectedList(prevState => {
            return {
                ...prevState,
                [val]: selected
            };
        });
    };
    const dispatch = useDispatch();
    const handleLangSelect = (e) => {
        e.preventDefault();
        let list = [];
        for (let i in selectedList) {
            if (selectedList[i] === true)
                list.push(i.toLowerCase());
        }
        dispatch(setMusicLang(list));
    };


    return (
        <div style={useStyle.component} className="dropdown">
            <div className="dropdown-head">
                <p>請選擇習作等級</p>
            </div>
            <div className={"lang-list"}>
                {listOfLanguage.map((item) => {
                    return (
                        <LangList onClick={handleSelected} key={item} item={item}/>
                    );
                })}
            </div>
            <div className={"button-div"}>
                <Button onClick={handleLangSelect} style={useStyle.button.contained}>
                    確定
                </Button>
            </div>
        </div>
    );
}
export default DropDownLanguageList;