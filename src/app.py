from flask import Flask, request, jsonify, render_template
from urllib.parse import unquote

import json

MAIA = Flask(__name__, template_folder='html')


@MAIA.route('/')
def home():
    """
    TODO Comment
    :return:
    """
    return 'This is the REST API for Maia'


@MAIA.route('/oauth2callback', methods=['GET'])
def auth():
    """
    Google Authenication Callback
    """

    try:
        code = request.args.get('code')
        return render_template('index.html', code=code)
    except:
        return jsonify({"error:": "Invalid Parameters"})

@MAIA.route('/login', methods=['GET'])
def login():
    """
    Account Login
    """

    try:
        user = json.loads(unquote(request.args.get('state')))
        tokens = json.loads(unquote(request.args.get('tokens')))
        
        return jsonify({"user": user, "tokens": tokens})
    except:
        return jsonify({"error:": "Invalid Parameters"})


@MAIA.route('/api/free-slots')
def free_slots():
    """
    Retrieves the free slots for the user
    :return: Returns a JSON object containing the ranges of times which are busy
    """

    return jsonify([{
        "start": "2019-03-02T15:00:00Z",
        "end": "2019-03-02T20:30:00Z"
    }, {
        "start": "2019-03-03T02:00:00Z",
        "end": "2019-03-03T03:15:00Z"
    }])


if __name__ == '__main__':
    MAIA.run()
