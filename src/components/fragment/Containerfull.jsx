import React from 'react';
import '../assets/scss/Containerfull.scss';

const Containerfull = ({children}) => {
    return (
        <div className={"Containerfull"}>
            {children}
        </div>
    );
}

export default Containerfull;