from flask import Flask

MAIA = Flask(__name__)


@MAIA.route('/')
def hello_world():
    """
    TODO Comment
    :return:
    """
    return 'Hello World!'


if __name__ == '__main__':
    MAIA.run()
