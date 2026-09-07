import re
import random

def main():
    with open("all_words.md", "r", encoding="utf-8") as file:
        lines = [re.sub(r"\s+", ":", line.strip()) for line in file]
        unique_lines = list(set([line.split(':')[0] for line in lines]))

        random.shuffle(unique_lines)

        for word in unique_lines:
            print(word, end=" ")

if __name__ == '__main__':
    main()
