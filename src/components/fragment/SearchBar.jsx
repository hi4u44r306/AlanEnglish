import React, { useRef, useState} from "react";
import '../assets/scss/SearchBar.scss';
import {useDispatch} from "react-redux";
import {setSearch} from "../../actions/actions";
import {Link} from "react-router-dom";
// import Form from 'react-bootstrap/Form';
// import SearchIcon from '@mui/icons-material/Search';
import SearchIcon from "@material-ui/icons/SearchOutlined";


const SearchBar = () => {

    const [searchQuery, setSearchQuery] = useState("");
    const handleSearchQuery = (e) => {
        setSearchQuery(e.target.value);
    };
    const searchRef = useRef();


    const dispatch = useDispatch();
    const searchLink = useRef();
    const handleSearch = (e) => {
        e.preventDefault();
        dispatch(setSearch(searchQuery.toLowerCase()));
        if (searchQuery !== "")
            searchLink.current.click();
    };

    return (
        <div>
            <form onSubmit={handleSearch}>
                <Link to={"/home/search"} ref={searchLink}/>
                <div className="searchcontainer">
                    <div className="searchimg">
                    <SearchIcon style={{width:25, height:25}}/>
                    </div>
                    <div className="serachinput">
                        <input
                        onSubmit={handleSearch} 
                        name={"searchQuery"}
                        value={searchQuery}
                        onChange={handleSearchQuery}
                        ref={searchRef}
                        type="search"
                        placeholder="搜尋音軌..."
                        className="searchbar form-control"
                    />
                    </div>
                   
                </div>
            </form>
        </div>
    );
};

export default SearchBar;