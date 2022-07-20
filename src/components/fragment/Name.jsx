import React from 'react';
import '../assets/scss/Name.scss';

function Name({className,length,name}) {
    return (
        <p className={className}>
                { length > 20 ? name.substring(0,20)+"..." : name}
        </p>
    );
}

export default Name;