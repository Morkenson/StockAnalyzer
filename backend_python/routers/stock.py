"""Stock API routes - search, quote, details, historical, batch quotes."""
import logging
from typing import List

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from models.common import ApiResponse
from models.stock_models import (
    StockDetails,
    StockHistoricalData,
    StockQuote,
    StockSearchResult,
)
from services import stock_data_service as stock_svc

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/stock", tags=["stock"])


@router.get("/search")
async def search_stocks(query: str = Query(..., alias="query")):
    try:
        if not (query or str(query).strip()):
            return JSONResponse(
                status_code=400,
                content=ApiResponse(success=False, message="Query parameter is required").model_dump(by_alias=True),
            )
        results = await stock_svc.search_stocks(str(query).strip())
        return ApiResponse(success=True, data=results).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error searching stocks")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/quote/{symbol}")
async def get_stock_quote(symbol: str):
    try:
        quote = await stock_svc.get_stock_quote(symbol)
        if quote is None:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message=f"Stock quote not found for symbol: {symbol}",
                ).model_dump(by_alias=True),
            )
        return ApiResponse(success=True, data=quote).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error getting stock quote for symbol %s", symbol)
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/details/{symbol}")
async def get_stock_details(symbol: str):
    try:
        details = await stock_svc.get_stock_details(symbol)
        if details is None:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message=f"Stock details not found for symbol: {symbol}",
                ).model_dump(by_alias=True),
            )
        return ApiResponse(success=True, data=details).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error getting stock details for symbol %s", symbol)
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.post("/quotes")
async def get_multiple_quotes(symbols: List[str]):
    try:
        if not symbols:
            return JSONResponse(
                status_code=400,
                content=ApiResponse(success=False, message="Symbols list is required").model_dump(by_alias=True),
            )
        quotes = await stock_svc.get_multiple_stock_quotes(symbols)
        return ApiResponse(success=True, data=quotes).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error getting multiple stock quotes")
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )


@router.get("/historical/{symbol}")
async def get_historical(
    symbol: str,
    interval: str = Query("1day", alias="interval"),
    output_size: int | None = Query(None, alias="outputSize"),
):
    try:
        data = await stock_svc.get_historical_data(symbol, interval, output_size)
        if not data:
            return JSONResponse(
                status_code=404,
                content=ApiResponse(
                    success=False,
                    message=f"Historical data not found for symbol: {symbol}",
                ).model_dump(by_alias=True),
            )
        return ApiResponse(success=True, data=data).model_dump(by_alias=True)
    except Exception as ex:
        logger.exception("Error getting historical data for symbol %s", symbol)
        return JSONResponse(
            status_code=400,
            content=ApiResponse(success=False, message=str(ex)).model_dump(by_alias=True),
        )
