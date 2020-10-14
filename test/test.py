import unittest
from src import hello_world

class MyTestCase(unittest.TestCase):
    def test_something(self):
        result = "hello_world"
        self.assertEqual(hello_world.hello().hi(), result)


if __name__ == '__main__':
    unittest.main()
