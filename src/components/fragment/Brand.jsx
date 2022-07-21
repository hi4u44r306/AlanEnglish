import React from "react";
import {Link} from "react-router-dom";
import "../assets/scss/Brand.scss";

class Brand extends React.Component {
    render() {
        return (
            <div className={"brand"}>
                <Link to={"/home"}>
                <h1>
                    <span>A</span>
                    <span>L</span>
                    <span>A</span>
                    <span>N</span>
                    <span> </span>
                    <span>E</span>
                    <span>N</span>
                    <span>G</span>
                    <span>L</span>
                    <span>I</span>
                    <span>S</span>
                    <span>H</span>
                </h1>
                </Link>
            </div>
        );
    }
}

export default Brand;