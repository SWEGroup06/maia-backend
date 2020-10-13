import unittest
import hello_world

class Tester(unittest.TestCase):

    def test(self):
        result = "hello_world"
        self.assertEqual(hello_world.hello().hi(), result)


if __name__ == '__main__':
    unittest.main()
