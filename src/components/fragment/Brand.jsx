import React from "react";
import wordmark from "../assets/img/alan-english-rounded.svg";
import compactWordmark from "../assets/img/alan-english-rounded-compact.svg";
import "../assets/scss/Brand.css";

class Brand extends React.Component {
    render() {
        return (
            <div className={`brand ${this.props.className || ""}`.trim()} role="img" aria-label="Alan English">
                <img className="brand-wordmark" src={wordmark} width="1328" height="134" alt="" aria-hidden="true" draggable="false" />
                <img className="brand-wordmark-compact" src={compactWordmark} alt="" aria-hidden="true" draggable="false" />
            </div>
        );
    }
}

export default Brand;
