import React from 'react';
import '../assets/scss/Name.scss';

function Name({className,length,name}) {
    return (
        <p className={className}>
                { length > 30? name.substring(0,30)+"..." : name}
        </p>
    );
}

export default Name;