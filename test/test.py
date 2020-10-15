import unittest
from src import hello_world


class MyTestCase(unittest.TestCase):
    """
    Test cases for Maia backend.
    TODO: Improve this docstring
    """

    def test_something(self):
        """

        :return:
        """
        result = "Hello, world!"
        self.assertEqual(hello_world.say_hello_world(), result)


if __name__ == '__main__':
    unittest.main()
