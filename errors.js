class DecalogError {

  constructor(code = DecalogError.SUCCESS, data={}, msg="Success") {

    this.code = code;
    this.data = data;
    this.message=msg
  }

  isError()
  {
    return this.code!=DecalogError.SUCCESS;
  }

  toString()
  {
    return "Erreur "+this.code+" : "+this.message+" : "+JSON.stringify(this.data)
  }

  throw()
  {
    if(this.code!=DecalogError.SUCCESS)
    { 
      if(Error.captureStackTrace) {
        Error.captureStackTrace(this, DecalogError);
      }
      throw new Error(this.toString())
    }
  }

  test()
  {
    if(this.isError())
    {
      this.throw()
    }
    return this.data
  }

}

DecalogError.SUCCESS="SUCCESS"
DecalogError.ERROR_STATUS="ERROR_STATUS"
DecalogError.ERROR_DATA="ERROR_DATA"
DecalogError.ERROR_DISCONNECTED="ERROR_DISCONNECTED"
DecalogError.ERROR_NON_UNIQUE_CODE="ERROR_NON_UNIQUE_CODE"


module.exports=DecalogError
