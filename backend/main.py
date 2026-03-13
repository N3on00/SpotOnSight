import uvicorn

# Import schema modules so decorators run and routers get registered
from models import schemas  # noqa: F401

from core.application import Routing


def create_app():
    return Routing().get_app()


if __name__ == "__main__":
    uvicorn.run(create_app(), host="0.0.0.0", port=8000)
