from flask import Flask, jsonify

MAIA = Flask(__name__)


@MAIA.route('/')
def home():
    """
    TODO Comment
    :return:
    """
    return 'This is the REST API for Maia'


@MAIA.route('/api/login')
def login():
    """
    TODO Comment
    :return:
    """
    return jsonify({"login": "Test"})

@MAIA.route('/api/busy-slots')
def busy_slots():
    """
    Retrieves the busy slots for the user
    :return: Returns a JSON object containing the ranges of times which are busy
    """

    return jsonify([{
          "start": "2019-03-02T15:00:00Z",
          "end": "2019-03-02T20:30:00Z"
        },{
          "start": "2019-03-03T02:00:00Z",
          "end": "2019-03-03T03:15:00Z"
        }])


if __name__ == '__main__':
    MAIA.run()
