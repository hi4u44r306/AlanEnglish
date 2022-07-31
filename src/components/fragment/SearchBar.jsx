import React, { useRef, useState} from "react";
import '../assets/scss/SearchBar.scss';
import {useDispatch} from "react-redux";
import {setSearch} from "../../actions/actions";
import {Link} from "react-router-dom";
import Form from 'react-bootstrap/Form';

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
        <div >
            <form onSubmit={handleSearch} className={"search-container"}>
                <Link to={"/home/search"} ref={searchLink}/>
                        <Form.Control
                            id={"search-input"}
                            name={"searchQuery"}
                            value={searchQuery}
                            onChange={handleSearchQuery}
                            ref={searchRef}
                            type="search"
                            placeholder="搜尋音軌..."
                            className="searchbar border border-dark"
                            aria-label="Search"
                        />
            </form>
        </div>
    );
};

export default SearchBar;