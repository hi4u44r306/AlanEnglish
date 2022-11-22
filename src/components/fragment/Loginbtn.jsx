import React, { useState, useEffect } from "react";

import LoaderButton from "loader-button";

function Loginbtn() {
  const [ButtonLoading, setButtonLoading] = useState(false);

  const [loadingSpeed] = useState(1);

  useEffect(() => {
    if (ButtonLoading) {
      setTimeout(() => {
        setButtonLoading(false);
      }, 2000 / loadingSpeed);
    }
  }, [ButtonLoading, loadingSpeed]);

  return (
    <div className="App">
        <LoaderButton varient='plain' size={'lg'} isLoading={ButtonLoading} onClick={()=>setButtonLoading(true)}>
            ButtonLoader
        </LoaderButton>
    </div>
  );
}

export default Loginbtn;