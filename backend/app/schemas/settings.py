from pydantic import BaseModel, Field


class HotelSettingsBase(BaseModel):
    hotel_name: str = Field(..., min_length=1, max_length=120)
    tagline: str = Field("", max_length=120)
    address: str = Field(..., min_length=1, max_length=255)
    mobile_numbers: str = Field(..., min_length=1, max_length=120)
    gst_number: str = Field("", max_length=30)
    hsn_code: str = Field("", max_length=20)
    cgst_percent: float = Field(..., ge=0, le=50)
    sgst_percent: float = Field(..., ge=0, le=50)
    jurisdiction: str = Field("", max_length=80)


class HotelSettingsUpdate(HotelSettingsBase):
    pass


class HotelSettingsOut(HotelSettingsBase):
    model_config = {"from_attributes": True}
